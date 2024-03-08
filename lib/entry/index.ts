// Entry

import _ from 'lodash';
import async from 'async';
import utils from './../utils';
import validate from './../validate';
import fields from "./fields";
import EntryAddenda from '../entry-addenda';
import { NumberField, StringField } from '../types';
const highLevelOverrides = ['transactionCode', 'receivingDFI', 'checkDigit', 'DFIAccount', 'amount', 'idNumber', 'individualName', 'discretionaryData', 'addendaId', 'traceNumber'];
type highLevelOverrides = typeof highLevelOverrides[number];
// type Header = { [K in keyof ReturnType<typeof header>]: ReturnType<typeof header>[K] extends { number: true } ? NumberField : StringField } // Record<keyof Mutable<ReturnType<typeof header>>, Field>;
type Fields = { [K in keyof ReturnType<typeof fields>]: ReturnType<typeof fields>[K] extends { number: true } ? NumberField : StringField } // Record<keyof Mutable<ReturnType<typeof control>>, Field>;
function is<T>(a: any, b: boolean): a is T { return b; }
type EntryOptions =
	{
		[key in keyof Fields as key extends highLevelOverrides ? key : never]?: string;
	} & {
		fields?: { [K in keyof typeof fields]?: string };
	}

export default class Entry {
	_addendas: EntryAddenda[];
	fields: any;
	constructor(options: EntryOptions) {
		this._addendas = [];

		// Allow the file header defaults to be overriden if provided
		this.fields = options.fields ? _.merge(options.fields, fields()) : fields();

		// Set our high-level values
		utils.overrideLowLevel(highLevelOverrides, options, this);

		// Some values need special coercing, so after they've been set by overrideLowLevel() we override them
		if (options.receivingDFI) {
			this.fields.receivingDFI.value = utils.computeCheckDigit(options.receivingDFI).slice(0, -1);
			this.fields.checkDigit.value = utils.computeCheckDigit(options.receivingDFI).slice(-1);
		}

		if (options.DFIAccount) {
			this.fields.DFIAccount.value = options.DFIAccount.slice(0, this.fields.DFIAccount.width);
		}

		if (options.amount) {
			this.fields.amount.value = Number(options.amount);
		}

		if (options.idNumber) {
			this.fields.idNumber.value = options.idNumber;
		}

		if (options.individualName) {
			this.fields.individualName.value = options.individualName.slice(0, this.fields.individualName.width);
		}

		if (options.discretionaryData) {
			this.fields.discretionaryData.value = options.discretionaryData;
		}

		// Validate required fields have been passed
		this._validate();

		return this;
	}
	addAddenda(entryAddenda: EntryAddenda) {

		// Add indicator to Entry record
		this.set('addendaId', '1');

		// Set corresponding feilds on Addenda
		entryAddenda.set('addendaSequenceNumber', this._addendas.length + 1);
		entryAddenda.set('entryDetailSequenceNumber', this.get('traceNumber'));

		// Add the new entryAddenda to the addendas array
		this._addendas.push(entryAddenda);
	}
	addReturnAddenda(entryAddenda: EntryAddenda) {
		// Add indicator to Entry record
		this.set('addendaId', '1');

		// Set corresponding fields on Addenda
		entryAddenda.set('traceNumber', this.get('traceNumber'));

		// Add the new entryAddendaReturn to the addendas array
		this._addendas.push(entryAddenda);
	}
	getRecordCount() {
		return this._addendas.length + 1;
	}
	generateString(cb: (res: string) => void) {
		let self = this;
		async.map<EntryAddenda, string>(self._addendas, function (entryAddenda, done) {
			utils.generateString(entryAddenda.fields, function (string) {
				done(null, string);
			});
		}, function (err, addendaStrings) {
			utils.generateString(self.fields, function (string: string) {
				cb([string].concat(addendaStrings as string[]).join(utils.newLineChar()));
			});
		});
	}
	_validate() {

		// Validate required fields
		validate.validateRequiredFields(this.fields);

		// Validate the ACH code passed is actually valid
		validate.validateACHCode(this.fields.transactionCode.value);

		// Validate the routing number
		validate.validateRoutingNumber(this.fields.receivingDFI.value + this.fields.checkDigit.value);

		// Validate header field lengths
		validate.validateLengths(this.fields);

		// Validate header data types
		validate.validateDataTypes(this.fields);
	}
	get(category: string) {

		// If the header has it, return that (header takes priority)
		if (is<keyof Fields>(category, !!(this.fields as any)[category])) {
			return this.fields[category]['value'];
		}
	}
	set<K extends string>(category: K, value: K extends keyof Fields ? Fields[K]['value'] : never) {

		// If the header has the field, set the value
		if (is<keyof Fields>(category, !!(this.fields as any)[category])) {
			this.fields[category]['value'] = value;
		}
	}

}






