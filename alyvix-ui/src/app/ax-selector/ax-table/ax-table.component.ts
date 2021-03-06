import { Component, OnInit, Inject, ViewChild, ElementRef, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { AxSelectorObject, AxSelectorObjects, AxSelectorComponentGroups } from 'src/app/ax-model/model';
import { DomSanitizer } from '@angular/platform-browser';
import { SelectorGlobal } from '../global';
import { AlyvixApiService } from 'src/app/alyvix-api.service';
import { environment } from 'src/environments/environment';
import { ResizedEvent } from 'angular-resize-event';


import * as _ from 'lodash';
import { Utils } from 'src/app/utils';
import { SelectorUtils } from '../selector-utils';
import { SelectorDatastoreService } from '../selector-datastore.service';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { ObjectsRegistryService } from 'src/app/ax-editor/objects-registry.service';
import { Step } from 'src/app/ax-editor/central-panel/script-editor/step/step.component';
import { Draggable } from 'src/app/utils/draggable';
import { ModalService, Modal } from 'src/app/modal-service.service';
import { RunnerService } from 'src/app/runner.service';

export interface RowVM{
  name:string
  object:AxSelectorObject
  selectedResolution:string,
  id:string
}

interface SortDescriptor{
  column: string
  asc: boolean
}


@Component({
  selector: 'ax-table',
  templateUrl: './ax-table.component.html',
  styleUrls: ['./ax-table.component.scss']
})
export class AxTableComponent implements OnInit {

  constructor(
    private _sanitizer: DomSanitizer,
    @Inject('GlobalRefSelector') private global: SelectorGlobal,
    private api:AlyvixApiService,
    private runner:RunnerService,
    private datastore:SelectorDatastoreService,
    private changeDetecor: ChangeDetectorRef,
    private objectRegistry:ObjectsRegistryService,
    private modal:ModalService
    ) {}


  production: boolean = environment.production;
  private _data: RowVM[] = [];

  imageUpdate = 0;


  @Output() import = new EventEmitter<RowVM[]>();

  @Input()
  readonly: boolean;

  @Input() editor:boolean;

  @Output() dataChange:EventEmitter<RowVM[]> = new EventEmitter<RowVM[]>();
  @Input()
  set data(data: RowVM[]) {
    this._data = data;
    if (data.length > 0) {
      this.selectedRows = [data[0]];
    }
    this.updateResolutions();
    this.changeResolution();
    this.datastore.changedSelection.emit(this.selectedRows);
  }

  private updateResolutions() {
    this.resolutions = _.uniq(
      [this.currentResolution].concat(
        _.flatten(
          this._data.map(o => this.resolutionsForObject(o.object.components))
        )
      )
    );
  }


  get data(): RowVM[] {
    return this._data;
  }

  private editing:RowVM = null;

  sort: SortDescriptor = {column: 'name', asc: true};
  filteredData: RowVM[];
  selectedRows: RowVM[] = [];
  resolutions: string[]

  currentResolution: string = this.global.res_string;
  selectedResolution = this.currentResolution;
  searchElementQuery = '';




  importRows() {
    this.import.emit(this.selectedRows);
  }


  private resolutionsForObject(component: {[key:string]:AxSelectorComponentGroups}):string[] {
    return Object.entries(component).map(
      ([key, value]) =>  {
         return key
      }
    );
  }

  objectKeys = Object.keys;

  imageUrl(row:RowVM) {
    return this._sanitizer.bypassSecurityTrustResourceUrl("/get_screen_for_selector?object_name="+row.name+"&resolution_string="+row.selectedResolution);
  }

  imageFor(image:string) {
    return this._sanitizer.bypassSecurityTrustResourceUrl("data:image/png;base64,"+image);
  }

  @ViewChild('tableContainer',{static: true}) tableContainer: ElementRef;

  onResized(event: ResizedEvent) {
    this.tableContainer.nativeElement.style.height = (event.newHeight - 44 - 70 - 27) + "px"
  }



  ok() {
    this.datastore.saveData(this.data,true).subscribe(x => console.log(x));
  }

  cancel() {
      this.api.selectorCancel()
  }

  edit() {
    if (this.singleSelection()) {
      this.editing = this.selectedRows[0];
      this.datastore.saveData(this.data,false).subscribe(x => {
        if (x.success) {
          this.api.selectorEdit(this.selectedRows[0].name, this.selectedRows[0].selectedResolution);
        }
      });
    }

  }

  delay:number = 0;
  newObject() {
    this.datastore.saveData(this.data,false).subscribe(x => {
      if (x.success) {
        this.api.newObject(this.delay).subscribe(x => {

        });
      }
    });
  }

  regrabObject() {
    if (this.singleSelection()) {
      this.editing = this.selectedRows[0];
      this.datastore.saveData(this.data,false).subscribe(x => {
        if (x.success) {
          this.api.grab(this.delay,this.editing.name).subscribe(x => {

          });
        }
      });
    }
  }

  changeTransactionGroup(row:RowVM,tg:string) {
    if(tg.length == 0) {
      row.object.measure.group = null;
    } else {
      row.object.measure.group = tg;
    }
  }

  selectRow(event: MouseEvent, row: RowVM) {
    if(event.shiftKey) {
      let leftIndex = -1;
      let rightIndex = -1;
      const rowIndex = this.filteredData.indexOf(row);
      this.filteredData.forEach((fd,i) => {
        if(this.isSelected(fd) && i < rowIndex ) {
          leftIndex = i;
        }
        if(this.isSelected(fd) && i > rowIndex) {
          rightIndex = i;
        }
      });
      if(leftIndex >= 0) { // found on the right
        for(let i = leftIndex+1; i <= rowIndex; i++) {
          this.selectedRows.push(this.filteredData[i]);
        }
      } else if(rightIndex > 0) {
        for(let i = rowIndex; i < rightIndex; i++) {
          this.selectedRows.push(this.filteredData[i]);
        }
      } else {
        this.selectedRows = [row];
      }
    } else if (event.ctrlKey) {
      if (this.isSelected(row)) {
        this.selectedRows = this.selectedRows.filter(r => r.id !== row.id);
      } else {
        this.selectedRows.push(row);
      }
    } else {
      this.selectedRows = [row];
    }
    this.datastore.setSelected(this.selectedRows);
    this.datastore.changedSelection.emit(this.selectedRows);
  }

  selectAll() {
    this.selectedRows = [];
    this.filteredData.forEach(r => this.selectedRows.push(r));
    this.changeDetecor.markForCheck();
    this.changeDetecor.detectChanges();
    this.datastore.setSelected(this.selectedRows);
  }

  deselectAll() {
    this.selectedRows = [];
    this.changeDetecor.markForCheck();
    this.changeDetecor.detectChanges();
    this.datastore.setSelected(this.selectedRows);
  }

  selectedNames(): string {
    return this.selectedRows.map(x => x.name).join(',');
  }

  remove() {

    this.modal.open({
      title: 'Delete',
      body: 'Do you really want to delete ' + this.selectedNames() + '?',
      list: _.flatMap(this.selectedRows,r => this.datastore.objectUsage(r.name)),
      actions: [
        {
          title: 'Delete',
          importance: 'btn-danger',
          callback: () => {
            this.data = this.data.filter(d => !this.isSelected(d));
            this.dataChange.emit(this.data);
            this.selectedRows = [];
            this.filterData();
          }
        }
      ],
      cancel: Modal.NOOP
    });


  }

  duplicate() {
    SelectorUtils.duplicateRows(this.selectedRows, this.data).forEach(r => this.selectedRows.push(r));
    this.dataChange.emit(this.data);
    this.datastore.saveData(this.data,false).subscribe(d => {
      this.filterData();
    });

  }

  hasFocus(input:HTMLInputElement):boolean {
    return document.activeElement === input;
  }



  sortColumn(column) {
    if (this.sort.column === column) {
      this.sort.asc = !this.sort.asc;
    } else {
      this.sort = {column: column, asc: true};
    }
    this.filterData();
  }

  changeResolution() {
    this.data.forEach(d => {
      const resolutions = this.resolutionsForObject(d.object.components);
      if(resolutions.includes(this.selectedResolution)) { //select the current resolution
        d.selectedResolution = this.selectedResolution;
      } else if (resolutions.includes(this.currentResolution)) {
        d.selectedResolution = this.currentResolution;
      } else {                                            //or the first resolution in the list
        d.selectedResolution = resolutions[0];
      }
    });
    this.filterData();
  }

  resetFilters() {
    this.searchElementQuery = '';
    this.selectedResolution = this.currentResolution;
    this.filterData();
  }

  filterData() {
    let self = this;
    this.filteredData = this.data.filter( d => //resolution filter
      this.selectedResolution == 'All' ||
      this.resolutionsForObject(d.object.components).includes(this.selectedResolution)
    ).filter(d => //name filtering
      d.object.date_modified.includes(this.searchElementQuery) || d.name.includes(this.searchElementQuery)
    ).sort((r1,r2) => {

      function compare(toColumn:(RowVM) => string):number {
        if(self.sort.asc) {
          return toColumn(r1).localeCompare(toColumn(r2));
        } else {
          return -toColumn(r1).localeCompare(toColumn(r2));
        }
      }

      switch(self.sort.column) {
        case 'name': return compare(x => x.name);
        case 'transaction_group': return compare(x => x.object.measure.group);
        case 'date': return compare(x => x.object.date_modified);
      }
    })

    this.selectedRows = this.selectedRows.filter(r => this.filteredData.some(r1 => r.id == r1.id)); //reduce selection to only visibles

    if (this.selectedRows.length === 0 && this.filteredData.length > 0) {
      this.selectedRows = [this.filteredData[0]];
    }
    this.datastore.setSelected(this.selectedRows);
  }

  isDuplicatedName(name:string):boolean {
    return SelectorUtils.isDuplicatedName(name, this.data);
  }



  private originalName = "";

  saveOriginalName(row:RowVM) {
    this.originalName = row.name;
  }

  nameKeyup(event: KeyboardEvent, row:RowVM) {
    if(event.keyCode === 13) { //enter
      this.confirmName(row,event.srcElement as HTMLInputElement)
    }
  }

  confirmName(row:RowVM, nameInput: HTMLInputElement) {
    console.log("name focus out")
    nameInput.value = row.name;

    if(row.name !== this.originalName) {

      const usages = this.datastore.objectUsage(this.originalName);


      if(usages.length > 0) {
        this.modal.open({
          title: 'Rename object',
          body: 'Are you sure you want to rename ' + this.originalName + ' to ' + row.name + '?',
          list: usages,
          actions: [
            {
              title: 'Rename All',
              importance: 'btn-primary',
              callback: () => {
                this.datastore.refactorObject(this.originalName,row.name)
                this.api.renameObject(this.originalName,row.name).subscribe( x=> {
                  this.datastore.changedNameRow.emit(row.name);
                  this.originalName = row.name;
                  this.datastore.save().subscribe(() => { });
                });
              }
            },
            {
              title: 'Rename',
              importance: 'btn-danger',
              callback: () => {
                this.api.renameObject(this.originalName,row.name).subscribe( x=> {
                  this.datastore.changedNameRow.emit(row.name);
                  this.originalName = row.name;
                });
              }
            }
          ],
          cancel: Modal.cancel(() => {
            row.name == this.originalName
            nameInput.value = this.originalName
          })
        });
      } else {
        this.api.renameObject(this.originalName,row.name).subscribe( x=> {
          this.datastore.changedNameRow.emit(row.name);
          this.originalName = row.name;
        });
      }
    }
  }

  onChangeName(row:RowVM,name: string, nameInput: HTMLInputElement) {
    if(this.datastore.nameValidation(nameInput, row.name) == null) {
      row.name = name;
    }

  }

  changeTimeout(row:RowVM,timeout:number) {
    row.object.detection.timeout_s = timeout;
    this.datastore.changedTimeout.emit(timeout);
  }

  isSelected(row:RowVM):boolean {
    return this.selectedRows.map(x => x.id).includes(row.id);
  }


  hasError():boolean {
    let result = true;
    if (this.data) {
      result = !this.data.every(d => {
        return d.name.length > 0 &&
        !this.isDuplicatedName(d.name) &&
        /^[a-zA-Z0-9_\- ]+$/.test(d.name);
      });
    }
    return result;
  }

  preventClick(event) {
    event.stopPropagation();
  }

  isEmptyTable():boolean {
    return this.filteredData.length == 0;
  }

  isSomethingSelected():boolean {
    return this.selectedRows.length > 0;
  }

  isSelectedInWorkingResolution():boolean {
    if (this.singleSelection) {
      return this.selectedRows[0].selectedResolution === this.currentResolution;
    } else {
      return false;
    }
  }

  isSelectedResolutionWorkingResolution():boolean {
    return this.selectedResolution === this.currentResolution;
  }

  singleSelection():boolean {
    return this.selectedRows.length === 1;
  }

  toStep(row:RowVM):Step {
    return {
      id: Utils.uuidv4(),
      name: row.name,
      type: 'object',
      condition: 'run',
      disabled: false
    };
  }

  objectDrag(event:DragEvent,row:RowVM) {
    Draggable.startDrag(event,"object",this.toStep(row));
  }

  breakClick(event,row:RowVM) {
    event.stopPropagation();
    row.object.detection.break = event.target.checked
    if(this.selectedRows.length == 1 && this.selectedRows[0].id === row.id) {
      this.datastore.changedBreak.emit(event.target.checked);
    }
  }

  measureClick(event,row:RowVM) {
    event.stopPropagation();
    row.object.measure.output = event.target.checked
  }

  addToScript(row:RowVM) {
    this.objectRegistry.addStep.emit(this.toStep(row));
  }

  run(row:RowVM) {
    this.runner.runOne(row.name);
  }




  selectorColumns = ['handle','name','transactionGroup','dateModified','timeout','break','measure','warning','critical','resolution','screen']

  private updateRow(r:RowVM,d:RowVM) {
    d.object.date_modified = r.object.date_modified
    d.object.components = r.object.components
    d.object.call = r.object.call
  }

  private updateLibrary(r:RowVM) {
    this.filteredData.filter(d => d.name === r.name).forEach(d => this.updateRow(r,d));
    this._data.filter(d => d.name === r.name).forEach(d => this.updateRow(r,d));
    this.selectedRows.filter(d => d.name === r.name).forEach(d => this.updateRow(r,d));
  }

  ngOnInit(): void {
    this.datastore.editRow().subscribe(r => {
      this.imageUpdate++
      if(this.editor && r && this.data.find(d => d.name === r.name)) {
        this.updateLibrary(r);
      } else if (r && this.editing) {
        r.id = this.editing.id;
        r.selectedResolution = this.editing.selectedResolution;

        const dataIndex = this._data.indexOf(this.editing);
        if ( dataIndex >= 0 ) { this._data[dataIndex] = r; }
        const selectedIndex = this.selectedRows.indexOf(this.editing);
        if ( selectedIndex >= 0 ) { this.selectedRows[selectedIndex] = r; }
        this.editing = null;
        this.filterData();
        this.updateResolutions();

      } else if(r && this.data.find(d => d.name === r.name)) {
        const dataIndex = this._data.findIndex(d => d.name === r.name);
        if ( dataIndex >= 0 ) { this._data[dataIndex] = r; }
        const selectedIndex = this.selectedRows.findIndex(d => d.name === r.name);
        if ( selectedIndex >= 0 ) { this.selectedRows[selectedIndex] = r; }
        this.updateResolutions();
        this.changeResolution();

      } else if(r) {
        this._data.push(r);
        this.updateResolutions();
        this.changeResolution();
        this.selectedRows = [r];
        this.datastore.setSelected(this.selectedRows);
        this.datastore.changedSelection.emit(this.selectedRows);
      }
    });




  }
}
