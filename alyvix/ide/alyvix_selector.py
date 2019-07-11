from alyvix.ide.server import ServerManager
from alyvix.ide.viewer import ViewerManager
from alyvix.ide.server.utilities.alyvixfile import AlyvixFileManager
from alyvix.tools.screen import ScreenManager
from alyvix.tools.library import LibraryManager
import socket
from multiprocessing import Process
import time
import os
import os.path
from datetime import datetime
import argparse
import base64
import cv2
import numpy as np
import sys

#os.environ["FLASK_ENV"] = "development"


def str2bool(v):
    if v.lower() in ('yes', 'true', 't', 'y', '1'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0'):
        return False
    else:
        raise argparse.ArgumentTypeError('Boolean value expected.')

# "alyvix-" + datetime.now().strftime("%H%M%S%Y") + ".json"

parser = argparse.ArgumentParser()

default_library_name = "VisualTestCase"
default_object_name = "VisualObject"

#requiredNamed = parser.add_argument_group('required named arguments')
#requiredNamed.add_argument('--filename', '-f', help="dummy description for help", type=str, default=None, required=True)
#requiredNamed.add_argument('--object', '-o', help="dummy description for help", type=str, default=None, required=True)

parser.add_argument('--filename', '-f', help="dummy description for help", type=str, default=None)
parser.add_argument('--window', '-w', help="dummy description for help", type=str2bool, default=True)
parser.add_argument('--verbose', '-v', help="dummy description for help", type=int, default=0)


#print(parser.format_help())

args = parser.parse_args()



def run_server(port, scaling_factor, filename, verbose, json_dict):
    #screen_manager = ScreenManager()
    server_manager = ServerManager()

    server_manager.set_scaling_factor(scaling_factor)
    server_manager.set_file_name(filename)
    server_manager.set_json(json_dict)

    server_manager.run(port, verbose)


if __name__ == '__main__':
    #if args.filename is not None and args.object is not None:

    filename_start_index = 1
    object_start_index = 1

    if args.filename is None:
        filename = default_library_name + str(filename_start_index)

        while True:
            if os.path.isfile(filename + ".alyvix") is False:
                filename = filename + ".alyvix"
                break

            filename_start_index += 1
            filename = default_library_name + str(filename_start_index)
    else:
        filename = args.filename


    lm = LibraryManager()

    filename = lm.get_correct_filename(filename)

    invalid_chars = lm.get_invalid_filename_chars()

    filename_invalid_chars = []

    filename_path = os.path.dirname(filename)
    filename_no_path = os.path.basename(filename)
    filename_no_extension = os.path.splitext(filename_no_path)[0]
    file_extension = os.path.splitext(filename_no_path)[1]

    for char in filename_no_extension:
        for invalid_char in invalid_chars:
            if char == str(invalid_char):
                filename_invalid_chars.append(char)

    if len(filename_invalid_chars) > 0:
        """
        invalid_char_str = filename_invalid_chars[0]
        for char in filename_invalid_chars[1:]:
            invalid_char_str = invalid_char_str + " " + char
        print("Invalid file name (" + filename_no_extension + "), the following characters are not valid: " +
              invalid_char_str)
        """
        print("A file name can't contain any of the following characters: \ / : * ? \" > < |")
        sys.exit(2)

    if os.path.isfile(filename) is True:

        lm.load_file(filename)
    else:
        lm.set_json({})


    screen_manager = ScreenManager()

    scaling_factor = screen_manager.get_scaling_factor()

    server_port = 5000

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    while True:
        result = sock.connect_ex(('127.0.0.1', server_port))

        if result != 0:
            break # the port doesn't exist
        else:
            server_port += 1


    sock.close()

    viewer_manager = ViewerManager()

    http_process = Process(target=run_server, args=(server_port, scaling_factor, filename, args.verbose,lm.get_json()))
    http_process.start()

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    while True:
        result = sock.connect_ex(('127.0.0.1', server_port))

        if result == 0:
            break # the port doesn't exist

    sock.close()

    #2 time.sleep(100)

    url = "http://127.0.0.1:" + str(server_port) + "/selector"

    if args.window is True:
        # open 2 fds
        null_fds = [os.open(os.devnull, os.O_RDWR) for x in range(2)]
        # save the current file descriptors to a tuple
        save = os.dup(1), os.dup(2)
        # put /dev/null fds on 1 and 2
        os.dup2(null_fds[0], 1)
        os.dup2(null_fds[1], 2)

        viewer_manager.run(url, fullscreen=False, dimension=(int(800*scaling_factor),int(460*scaling_factor)),
                           title="Alyvix Selector")



        # restore file descriptors so I can print the results
        os.dup2(save[0], 1)
        os.dup2(save[1], 2)
        # close the temporary fds
        os.close(null_fds[0])
        os.close(null_fds[1])

    else:
        while True:
            pass

    http_process.terminate()
    http_process.join()



