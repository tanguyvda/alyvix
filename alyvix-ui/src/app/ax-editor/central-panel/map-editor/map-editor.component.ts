import { Component, OnInit, Input,ChangeDetectorRef, Output,EventEmitter } from '@angular/core';
import { MapRowVM } from 'src/app/ax-selector/selector-datastore.service';
import { Utils } from 'src/app/utils';

export interface MapWithName{
  name: string,
  rows: MapRowVM[]
}



@Component({
  selector: 'app-map-editor',
  templateUrl: './map-editor.component.html',
  styleUrls: ['./map-editor.component.scss']
})
export class MapEditorComponent implements OnInit {

  displayedColumns: string[] = [];
  valuesColumns: string[] = [];
  dataSource = [];
  mapName:string = '';

  @Output() mapChange: EventEmitter<MapRowVM[]> = new EventEmitter();

  @Input() set rows(map:MapWithName) {

    if(map.rows && map.name != this.mapName) {
      this.mapName = map.name;
      this.valuesColumns = [];
      this.dataSource = [];
      this.valuesColumns = [];
      let lenghts:number[] = map.rows.map(r => r.values ? r.values.length : 1);
      this.displayedColumns.push("key");
      for(let i = 1; i<=Math.max(...lenghts);i++) {
        this.valuesColumns.push('value'+i);
      }
      this.dataSource = map.rows.map((r,i) => {
        let res = {id: Utils.uuidv4(), key: r.name}
        if(r.value) {
          res['value1'] = r.value;
        } else if(r.values) {
          r.values.forEach((x,i) => res['value'+(i+1)] = x);
        }
        return res;
      });
      this.displayedColumns = this.columns();

    }
  }

  private columns():string[] {
    return ['key'].concat(this.valuesColumns).concat(['actions']);
  }

  tableChanged(values:string[], current,column:string) {
    values[column] = current.target.value;
    this.emitChange()
  }

  addRow() {
    this.dataSource.push({id: Utils.uuidv4(), key: "new"});
    this.displayedColumns = ['key'];
    this.changeDetector.markForCheck();
    this.changeDetector.detectChanges();
    this.displayedColumns = this.columns();
    this.emitChange();
  }

  addColumn() {
    let i = 1;
    while (this.valuesColumns.indexOf('value' + i) >= 0) {
      i++;
    }
    const newColumn = 'value'+i;
    this.valuesColumns.push(newColumn);
    this.displayedColumns = this.columns();
    this.emitChange();
  }

  deleteColumn(columnName:string) {
    this.dataSource.forEach((ds,i) =>  delete this.dataSource[i][columnName]);
    this.valuesColumns.pop();
    this.displayedColumns = this.columns();
    this.emitChange();
  }

  deleteRow(row) {
    this.dataSource = this.dataSource.filter(ds => ds.id !== row.id);
    this.emitChange();
  }

  emitChange() {
    let result:MapRowVM[] = this.dataSource.map(row => {
      let res = {
        name: row.key
      }
      let values = [];
      this.valuesColumns.forEach(c => {
        if(row[c]) {
          values.push(row[c]);
        } else {
          values.push("")
        }
      });
      if(values.length == 1) {
        res['value'] = values[0];
      } else if(values.length > 1) {
        res['values'] = values;
      }
      return res;
    })
    this.mapChange.emit(result);
  }

  dataSourceTrackBy(i,o) {
    return o.id;
  }

  constructor(
    private changeDetector:ChangeDetectorRef
  ) { }

  ngOnInit() {
  }

}
