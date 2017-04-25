# Alyvix allows you to automate and monitor all types of applications
# Copyright (C) 2015 Alan Pipitone
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Developer: Alan Pipitone (Violet Atom) - http://www.violetatom.com/
# Supporter: Wuerth Phoenix - http://www.wuerth-phoenix.com/
# Official website: http://www.alyvix.com/

import argparse, sys
import tornado.ioloop
import tornado.gen
import time
import os

try:
    from nats.io.client import Client as NATS
except:
    pass

class NatsManager():

    @tornado.gen.coroutine
    def _pub(self, perfdata_list, testcase_name, subject, server, port=4222, measurement="alyvix",
                max_reconnect_attempts=5, reconnect_time_wait=2):

        current_timestamp = str(int(time.time()*1000*1000*1000))

        message_lines = []

        testcase_name = testcase_name.replace(" ", "_")

        nc = NATS()
        options = {"servers": ["nats://" + str(server) + ":" + str(port)]}

        exception_occurred = False

        #if we cannot contact nats server then we have to save messages to cache file
        exception_file_name = "data.txt"

        system_drive = os.environ['systemdrive']

        alyvix_programdata_path = system_drive + os.sep + "ProgramData\\Alyvix\\exception\\nats"\
                                  + os.sep + os.environ['username'] + os.sep + testcase_name

        exception_file_full_name = alyvix_programdata_path + os.sep + exception_file_name

        try:
            yield nc.connect(**options)
        except:
            exception_occurred = True

        file_to_read = None
        biggest_cnt = 0
        #read previous messages from cache. last txt file contains all messages
        if os.path.exists(alyvix_programdata_path):

            for file in os.listdir(alyvix_programdata_path):
                if file.endswith(".txt"):

                    if file == "data.txt":
                        if 0 > biggest_cnt:
                            biggest_cnt = 0
                    else:
                        cnt_str = file.replace("data_","").replace(".txt","")
                        cnt_int = int(cnt_str)

                        if cnt_int > biggest_cnt:
                            biggest_cnt = cnt_int

            if biggest_cnt == 0:
                file_to_read = os.path.join(alyvix_programdata_path, "data.txt")
            else:
                file_to_read = os.path.join(alyvix_programdata_path, "data_" + str(biggest_cnt) + ".txt")

            #read cached messages
            if os.path.exists(file_to_read):
                with open(file_to_read) as f:
                    message_lines.extend(f.readlines())
                f.close()

            #delete all cache files
            for file in os.listdir(alyvix_programdata_path):
                if file.endswith(".txt"):
                    try:
                        os.remove(os.path.join(alyvix_programdata_path, file))
                    except:
                        pass


        tmp_message_lines = []
        for message in message_lines:

            message = message.replace("\r\n", "")
            message = message.replace("\r", "")
            message = message.replace("\n", "")

            if message == "":
                pass

            try:
                #try to publish cached messages
                yield nc.publish(subject, message)
            except:
                tmp_message_lines.append(message)
                exception_occurred = True

        message_lines = tmp_message_lines

        #publish current performance data
        for perfdata in perfdata_list:

            perfdata_state = "ok"

            if perfdata.value == "" or perfdata.value is None:
                perfdata_state = "timedout"
            elif perfdata.state == 1:
                perfdata_state = "warning"
            elif perfdata.state == 2:
                perfdata_state = "critical"
            elif perfdata.state == 3:
                perfdata_state = "unknown"

            msg_extra = ""

            if perfdata.extra != None and perfdata.extra != "":
                msg_extra = ",extra=" + perfdata.extra

            msg_warning = ""

            if perfdata.warning_threshold != None and perfdata.warning_threshold != "":
                msg_warning = ",warning_threshold=" + str(int(perfdata.warning_threshold * 1000))

            msg_critical = ""

            if perfdata.critical_threshold != None and perfdata.critical_threshold != "":
                msg_critical = ",critical_threshold=" + str(int(perfdata.critical_threshold * 1000))

            msg_timeout = ""

            if perfdata.timeout_threshold != None and perfdata.timeout_threshold != "":
                msg_timeout = ",timeout_threshold=" + str(int(perfdata.timeout_threshold * 1000))

            msg_perf = ""
            if perfdata.value != "" and perfdata.value is not None:
                msg_perf = ",performance=" + str(int(perfdata.value * 1000))

            msg_errorlevel = ",error_level=0"

            if perfdata.value == "" or perfdata.value is None:
                msg_errorlevel = ",error_level=3"
            elif perfdata.state == 1:
                msg_errorlevel = ",error_level=1"
            elif perfdata.state == 2:
                msg_errorlevel = ",error_level=2"
            elif perfdata.state == 3:
                perfdata_state = msg_errorlevel = ",error_level=3"

            try:
                perf_timestamp = str(int(perfdata.timestamp*1000*1000))
            except:
                perf_timestamp = current_timestamp


            message= str(measurement) + ",test_name=" +str(testcase_name) + ",transaction_name=" +\
                     str(perfdata.name).replace(" ", "_") + ",state=" + perfdata_state + msg_extra + " " +\
                     msg_warning + msg_critical + msg_timeout + msg_perf + msg_errorlevel + " " + perf_timestamp

            message = message.replace(" ,"," ")


            try:
                yield nc.publish(subject, message)
            except:
                #store to cache list if we cannot publish messages
                message_lines.append(message)
                exception_occurred = True

        try:
            yield nc.flush()
        except:
            exception_occurred = True

        #store cache list to cache file
        if exception_occurred is True:
            if not os.path.exists(alyvix_programdata_path):
                os.makedirs(alyvix_programdata_path)

            try:
                with open(exception_file_full_name, 'w') as f:

                    for item in message_lines:
                        f.write("%s\r\n" % item)

                f.close()
            except:
                filename = exception_file_full_name
                cnt = 0
                while True:
                    if not os.path.exists(filename):
                        with open(filename, 'w') as f:

                            for item in message_lines:
                                f.write("%s\r\n" % item)

                        f.close()
                        break

                    cnt += 1

                    if (cnt-1) == 0:
                        filename = filename.replace(".txt", "_" + str(cnt) + ".txt")
                    else:
                        filename = filename.replace(str(cnt-1) + ".txt", str(cnt) + ".txt")



    def publish(self,perfdata_list, testcase_name, subject, server, port=4222, measurement="alyvix",
                max_reconnect_attempts=5, reconnect_time_wait=2):
        tornado.ioloop.IOLoop.instance().run_sync(lambda: self._pub(perfdata_list, testcase_name, subject, server, port=4222, measurement="alyvix",
                max_reconnect_attempts=5, reconnect_time_wait=2))