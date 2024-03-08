// File

import _ from 'lodash';
import async from 'async';
import utils from '../utils';
import validate from '../validate';
import header from './header';
import control from './control';
import Batch from '../batch';
import Entry from '../entry';
import EntryAddenda from '../entry-addenda';
import { Field, NumberField, StringField } from "../types";
function is<T>(a: any, b: boolean): a is T { return b; }

type Mutable<T> =
    T extends string | number | boolean | undefined | null ? T :
    T extends ReadonlyArray<infer U> ? Array<Mutable<U>> :
    { -readonly [P in keyof T]: Mutable<T[P]>; };

type Header = { [K in keyof ReturnType<typeof header>]: ReturnType<typeof header>[K] extends { number: true } ? NumberField : StringField } // Record<keyof Mutable<ReturnType<typeof header>>, Field>;
type Control = { [K in keyof ReturnType<typeof control>]: ReturnType<typeof control>[K] extends { number: true } ? NumberField : StringField } // Record<keyof Mutable<ReturnType<typeof control>>, Field>;

const highLevelOverrides = ['immediateDestination', 'immediateOrigin', 'fileCreationDate', 'fileCreationTime', 'fileIdModifier', 'immediateDestinationName', 'immediateOriginName', 'referenceCode'] as const;

type highLevelOverrides = typeof highLevelOverrides[number] | 'standardEntryClassCode' | 'batchSequenceNumber';

type FileOptions =
    {
        [key in keyof Header as key extends highLevelOverrides ? key : never]?: string;
    } & {
        [key in keyof Control as key extends highLevelOverrides ? key : never]?: string;
    } & {
        standardEntryClassCode?: string;
        batchSequenceNumber?: string;
        header?: { [K in keyof typeof header]?: string };
        control?: { [K in keyof typeof control]?: string };
    }


export default class File {
    _batches: Batch[];
    header: Header;
    control: Control;
    _batchSequenceNumber: number;
    constructor(options: FileOptions) {
        this._batches = [];

        // Allow the batch header/control defaults to be overriden if provided
        this.header = options.header ? _.merge(options.header, header()) : header();
        this.control = options.control ? _.merge(options.control, control()) : control();

        // Configure high-level overrides (these override the low-level settings if provided)
        utils.overrideLowLevel(highLevelOverrides, options, this);

        if (options.standardEntryClassCode === 'ADV') {
            this.control.totalDebit.width = 20;
            this.control.totalCredit.width = 20;
            this.control.reserved.width = 23;
        }

        // This is done to make sure we have a 9-digit routing number
        if (options.immediateDestination) {
            this.header.immediateDestination.value = utils.computeCheckDigit(options.immediateDestination);
        }

        this._batchSequenceNumber = Number(options.batchSequenceNumber) || 0;

        // Validate all values
        this._validate();

        return this;
    }
    get(field: string | number) {

        // If the header has the field, return the value
        if (is<keyof Header>(field, !!(this.header as any)[field])) {
            return this.header[field]['value'];
        }

        // If the control has the field, return the value
        if (is<keyof Control>(field, !!(this.control as any)[field])) {
            return this.control[field]['value'];
        }

    }
    set(field: string | number, value: any) {

        // If the header has the field, set the value
        if (is<keyof Header>(field, !!(this.header as any)[field])) {
            // @ts-ignore
            this.header[field]['value'] = value;
        }

        // If the control has the field, set the value
        if (is<keyof Control>(field, !!(this.control as any)[field])) {
            // @ts-ignore
            this.control[field]['value'] = value;
        }
    }
    _validate() {

        // Validate header field lengths
        validate.validateLengths(this.header);

        // Validate header data types
        validate.validateDataTypes(this.header);

        // Validate control field lengths
        validate.validateLengths(this.control);

        // Validate header data types
        validate.validateDataTypes(this.control);
    }
    addBatch(batch: Batch) {

        // Set the batch number on the header and control records
        batch.header.batchNumber.value = this._batchSequenceNumber;
        batch.control.batchNumber.value = this._batchSequenceNumber;

        // Increment the batchSequenceNumber
        ++this._batchSequenceNumber;

        this._batches.push(batch);
    }
    generatePaddedRows(rows: number, cb: { (paddedString: any): void; (arg0: string): void; }) {
        let paddedRows = '';

        for (let i = 0; i < rows; i++) {
            paddedRows += utils.newLineChar() + utils.pad('', 94, '9');
        }

        // Return control flow back by calling the callback function
        cb(paddedRows);
    }
    generateBatches(done1: { (batchString: any, rows: any): void; (arg0: string, arg1: number): void; }) {
        let self = this;

        let result = '';
        let rows = 2;

        let entryHash = 0;
        let addendaCount = 0;

        let totalDebit = 0;
        let totalCredit = 0;


        async.each(this._batches, function (batch: Batch, done2): void {
            totalDebit += batch.control.totalDebit.value;
            totalCredit += batch.control.totalCredit.value;

            async.each(batch._entries, function (entry: Entry, done3): void {
                if (Object.keys(entry.fields).indexOf('sequenceNumberWithinBatch') === -1) entry.fields.traceNumber.value = (entry.fields.traceNumber.value ? entry.fields.traceNumber.value : self.header.immediateOrigin.value.slice(0, 8)) + utils.pad(addendaCount, 7, false, '0');
                async.each(entry._addendas, function (addenda: EntryAddenda, done4): void {
                    let keys = Object.keys(addenda.fields);
                    if (keys.indexOf('traceNumber') !== -1) addenda.fields.traceNumber.value = entry.fields.traceNumber.value || (self.header.immediateOrigin.value.slice(0, 8) + utils.pad(addendaCount, 7, false, '0'));
                    if (keys.indexOf('entryDetailSequenceNumber') !== -1) addenda.fields.entryDetailSequenceNumber.value = entry.fields.traceNumber.value.slice(0 - addenda.fields.entryDetailSequenceNumber.width);
                    done4();
                });

                entryHash += Number(entry.fields.receivingDFI.value);

                // Increment the addenda and block count
                addendaCount++;
                rows++;

                done3();
            }, function () {

                // Only iterate and generate the batch if there is at least one entry in the batch
                if (batch._entries.length > 0) {

                    // Increment the addendaCount of the batch
                    self.control.batchCount.value++;

                    // Bump the number of rows only for batches with at least one entry
                    rows = rows + 2;

                    // Generate the batch after we've added the trace numbers
                    batch.generateString(function (batchString: string) {
                        result += batchString + utils.newLineChar();
                        done2();
                    });
                } else {
                    done2();
                }
            });
        }, function () {
            self.control.totalDebit.value = totalDebit;
            self.control.totalCredit.value = totalCredit;

            self.control.addendaCount.value = addendaCount;
            self.control.blockCount.value = utils.getNextMultiple(rows, 10) / 10;

            // Slice the 10 rightmost digits.
            self.control.entryHash.value = entryHash.toString().slice(-10);

            // Pass the result string as well as the number of rows back
            done1(result, rows);
        });
    }
    generateHeader(cb: { (headerString: any): void; (arg0: any): void; }) {
        utils.generateString(this.header, function (string: any) {
            cb(string);
        });
    }
    generateControl(cb: { (controlString: any): void; (arg0: any): void; }) {
        utils.generateString(this.control, function (string: any) {
            cb(string);
        });
    }
    generateFile(cb: (arg0: string) => void) {
        let self = this;

        self.generateHeader(function (headerString: string) {
            self.generateBatches(function (batchString: string, rows: any) {
                self.generateControl(function (controlString: string) {

                    // These must be within this callback otherwise rows won't be calculated yet
                    let paddedRows = utils.getNextMultipleDiff(rows, 10);

                    self.generatePaddedRows(paddedRows, function (paddedString: string) {
                        cb(headerString + utils.newLineChar() + batchString + controlString + paddedString);
                    });
                });
            });
        });
    }
}









