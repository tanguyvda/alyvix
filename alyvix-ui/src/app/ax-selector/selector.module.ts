import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { environment } from 'src/environments/environment';
import { SelectorComponent } from './selector.component';
import { AxSelectorComponent } from './ax-selector.component';

import {CdkTableModule} from '@angular/cdk/table'
import { AngularResizedEventModule } from 'angular-resize-event';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AxTableComponent } from './ax-table/ax-table.component';
import { CopyClipboardDirective } from '../directives/copy-clipboard.directive';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { AxModalComponent } from '../common/ax-modal/ax-modal.component';
import { NgxSmartModalModule } from 'ngx-smart-modal';


@NgModule({
  declarations: [
    SelectorComponent,
    AxSelectorComponent,
    AxTableComponent,
    CopyClipboardDirective,
    AxModalComponent
  ],
  imports: [
    BrowserModule,
    CdkTableModule,
    AngularResizedEventModule,
    HttpClientModule,
    FormsModule,
    DragDropModule,
    BrowserAnimationsModule, // required animations module
    ToastrModule.forRoot(),
    NgxSmartModalModule.forRoot()
  ],
  providers: [
    {provide: 'GlobalRefSelector', useClass: environment.globalTypeSelector},
    {provide: 'subSystem', useValue: 'selector'}
  ],
  bootstrap: [SelectorComponent]
})
export class SelectorModule { }
