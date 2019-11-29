import { Component, OnInit, ViewChild } from '@angular/core';
import { ObjectsRegistryService } from '../../objects-registry.service';
import { CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Step } from './step/step.component';

@Component({
  selector: 'app-script-editor',
  templateUrl: './script-editor.component.html',
  styleUrls: ['./script-editor.component.scss']
})
export class ScriptEditorComponent implements OnInit {


  @ViewChild('actions', {static: true}) actions:CdkDropList;

  steps: Step[] = [];

  constructor(private objectRegistry:ObjectsRegistryService) { }

  ngOnInit() {
    this.objectRegistry.addObjectList(this.actions);
    //this.steps.push({name: 'bla', type: 'map'});
  }

  dropped(event: CdkDragDrop<any,any>) {
    console.log('actions');
    console.log(event);
    switch(event.previousContainer.data) {
      case 'actions':
        moveItemInArray(this.steps, event.previousIndex, event.currentIndex);
        break;
      case 'object':
      case 'map':
        this.steps.push({name: event.item.data, type: event.previousContainer.data});
        break;
    }
  }

  enter(event) {
    console.log("enter parent");
    console.log(event);
  }

}
