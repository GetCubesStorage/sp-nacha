import { File, Batch, Entry } from "./dist/index.js";
const {
  companyOrigin,
  companyName,
  internalData,
  secCode,
  recipientRouting,
  recipientAccount,
  recipientName,
  recipientNumber,
  amount,
} = {
  /** Assigned by fulton bank (possibly account number) */
  companyOrigin: "",
  /** company name as shown on the customer's bank statement (16 characters) */
  companyName: "",
  /** companyDiscretionaryData (20 characters) */
  internalData: "",
  secCode: "WEB",
  recipientRouting: "",
  recipientAccount: "",
  recipientNumber: "",
  recipientName: "",
  amount: "1000",
}

const file = new File({
  // (10 chars)
  immediateDestination: "031301422",
  // (41-63 = 23 chars)
  immediateDestinationName: "Fulton Bank",
  // (10 chars)
  immediateOrigin: companyOrigin,
  // (64-86 = 23 chars)
  immediateOriginName: companyName,
  standardEntryClassCode: secCode
});

const batch = new Batch({
  // 200 for credits & debits, 220 for credits, 225 for debits.
  serviceClassCode: '200',
  // company name as shown on the customer's bank statement (16 characters)
  companyName: companyName,
  // internal data (20 characters)
  companyDiscretionaryData: internalData,
  // company id number (10 characters)
  companyIdentification: companyOrigin,
  // SEC code (3 chars)
  standardEntryClassCode: secCode,
  // information purposes (10 characters)
  companyEntryDescription: "Payroll",
  // information purposes (6 characters)
  companyDescriptiveDate: "YYMMDD",
  // not sure exactly how this is used
  effectiveEntryDate: "YYMMDD",
  // first 8 of the bank routing number
  originatingDFI: "03130142",

})


const entry = new Entry({

  recordTypeCode: "6",
  transactionCode: "22",
  receivingDFI: recipientRouting,
  DFIAccount: recipientAccount,
  amount,
  idNumber: recipientNumber,
  individualName: recipientName,
  traceNumber: companyOrigin,
});

batch.addEntry(entry);
file.addBatch(batch);
