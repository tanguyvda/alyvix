import { Component, OnInit, Inject, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { AxSelectorObject, AxSelectorObjects, AxSelectorComponentGroups } from 'src/app/ax-model/model';
import { DomSanitizer } from '@angular/platform-browser';
import { GlobalRef } from '../global';
import { AlyvixApiService } from 'src/app/alyvix-api.service';
import { environment } from 'src/environments/environment';
import { ResizedEvent } from 'angular-resize-event';


import * as _ from 'lodash';
import { Utils } from 'src/app/utils';
import { SelectorUtils } from '../selector-utils';

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

  constructor(private _sanitizer: DomSanitizer,@Inject('GlobalRef') private global: GlobalRef,private apiService:AlyvixApiService) {}


  production: boolean = environment.production;
  private _data: RowVM[] = [];

  @Output() import = new EventEmitter<RowVM[]>();

  @Input()
  readonly: boolean;

  @Input()
  set data(data: RowVM[]) {
    this._data = data;
    if (data.length > 0) {
      this.selectedRows = [data[0]];
    }
    this.resolutions = _.uniq(
      [this.currentResolution].concat(
        _.flatten(
          data.map(o => this.resolutionsForObject(o.object.components))
        )
      )
    );
    this.filterData();
  }

  get data(): RowVM[] {
    return this._data;
  }

  sort: SortDescriptor = {column: 'name', asc: true};
  filteredData: RowVM[];
  selectedRows: RowVM[] = [];
  resolutions: string[]

  currentResolution: string = this.global.nativeGlobal().res_string;
  selectedResolution = this.currentResolution;
  searchElementQuery = '';


  singleSelection():boolean {
    return this.selectedRows.length === 1;
  }

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

  imageFor(image:string) {
    return this._sanitizer.bypassSecurityTrustResourceUrl("data:image/png;base64,"+image);
  }

  @ViewChild('tableContainer') tableContainer: ElementRef;
  onResized(event: ResizedEvent) {
    this.tableContainer.nativeElement.style.height = (event.newHeight - 44 - 70 - 27) + "px"
  }

  private prepareModelForSubmission():AxSelectorObjects {
    const model:AxSelectorObjects = { objects: {}};
    this.data.forEach( d => {
      model.objects[d.name] = d.object;
    });
    return model;
  }

  ok() {
    this.apiService.setLibrary({library: this.prepareModelForSubmission(), close_selector: true}).subscribe(x => console.log(x));
  }

  cancel() {
      this.global.nativeGlobal().cancel_button()
  }

  edit() {
    if (this.singleSelection()) {
      this.apiService.setLibrary({library: this.prepareModelForSubmission(), close_selector: false}).subscribe(x => {
        console.log(x);
        if (x.success) {
          this.global.nativeGlobal().edit(this.selectedRows[0].name, this.selectedRows[0].selectedResolution);
        }
      });
    }

  }

  delay:number = 0;
  newObject() {
    this.global.nativeGlobal().new_button(this.delay);
  }

  changeTransactionGroup(row:RowVM,tg:string) {
    if(tg.length == 0) {
      row.object.measure.group = null;
    } else {
      row.object.measure.group = tg;
    }
  }

  selectRow(event: MouseEvent, row: RowVM) {
    if (event.ctrlKey || event.shiftKey) {
      if (this.isSelected(row)) {
        this.selectedRows = this.selectedRows.filter(r => r.id !== row.id);
      } else {
        this.selectedRows.push(row);
      }
    } else if (!this.isSelected(row) || event.detail > 1) {
      this.selectedRows = [row];
    }
  }

  selectAll() {
    this.selectedRows = [];
    this.filteredData.forEach(r => this.selectedRows.push(r));
  }

  deselectAll() {
    this.selectedRows = [];
  }

  selectedNames(): string {
    return this.selectedRows.map(x => x.name).join(',');
  }

  remove() {
    if (confirm('Do you really want to delete ' + this.selectedNames() + '?')) {
      this.data = this.data.filter(d => !this.isSelected(d));
      this.selectedRows = [];
      this.filterData();
    }
  }

  duplicate() {
    SelectorUtils.duplicateRows(this.selectedRows, this.data).forEach(r => this.selectedRows.push(r));
    this.filterData();
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

  }

  isDuplicatedName(name:string):boolean {
    return SelectorUtils.isDuplicatedName(name, this.data);
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



  selectorColumns = ['name','transactionGroup','dateModified','timeout','break','measure','warning','critical','resolution','screen']

  ngOnInit(): void {

  }
}