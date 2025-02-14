"use client";

import { XMLParser } from "fast-xml-parser";
import styles from "./page.module.css";
import DromoUploader from "dromo-uploader-react";

const txtParser = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);
  const lines = text.split('\n').filter(line => line.trim());

  // Define headers based on the CFONB format fields
  const headers = [
    'RecordType',
    'BankCode',
    'DeskCode',
    'CurrencyCode',
    'AccountNumber',
    'BeneficiaryName',
    'BeneficiaryAddress1',
    'BeneficiaryAddress2',
    'BeneficiaryAddress3',
    'Amount',
    'OperationCode',
    'OperationDate',
    'Currency',
    'Reference',
    'BankDetails'
  ];

  const rows: string[][] = [headers];
  
  // Process each line
  lines.forEach(line => {
    const recordType = line.substring(0, 2);
    
    // Only process transaction records (type 04)
    if (recordType === '04') {
      const row = [
        recordType,
        line.substring(2, 7),        // Bank code
        line.substring(7, 11),       // Desk code
        line.substring(11, 14),      // Currency code
        line.substring(14, 39).trim(),    // Account number
        line.substring(39, 79).trim(),    // Beneficiary name
        line.substring(79, 119).trim(),   // Address line 1
        line.substring(119, 159).trim(),  // Address line 2
        line.substring(159, 199).trim(),  // Address line 3
        line.substring(199, 214).trim(),  // Amount
        line.substring(214, 217),    // Operation code
        line.substring(217, 223),    // Operation date
        line.substring(223, 226),    // Currency
        line.substring(226, 241).trim(),  // Reference
        line.substring(241).trim()        // Bank details
      ];
      rows.push(row);
    }
  });

  return rows;
};

const xmlParser = async (buffer: ArrayBuffer): Promise<string[][]> => {
  console.log("buffer", buffer);

  const decoder = new TextDecoder('utf-8');
  const xmlString = decoder.decode(buffer);
  
  // Configure and create parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true
  });
  
  // Parse XML to JSON
  const result = parser.parse(xmlString);
  const transfer = result.Document.FIToFICstmrCdtTrf;
  
  // Define headers
  const headers = [
    'MsgId',
    'CreDtTm',
    'NbOfTxs',
    'SttlmMtd',
    'InstrId',
    'EndToEndId',
    'UETR',
    'IntrBkSttlmAmt',
    'IntrBkSttlmAmt_Ccy',
    'IntrBkSttlmDt',
    'InstdAmt',
    'InstdAmt_Ccy',
    'ChrgBr',
    'InstgAgt_BICFI',
    'InstdAgt_BICFI',
    'IntrmyAgt1_BICFI',
    'IntrmyAgt1_Nm',
    'IntrmyAgt1_Address',
    'Dbtr_Nm',
    'Dbtr_Address',
    'DbtrAcct_IBAN',
    'DbtrAgt_BICFI',
    'CdtrAgt_BICFI',
    'CdtrAgt_Nm',
    'CdtrAgt_Address',
    'Cdtr_Nm',
    'Cdtr_Address',
    'CdtrAcct_IBAN',
    'Purp_Cd',
    'RmtInf_Ustrd'
  ];

  // Helper function to format address
  const formatAddress = (addr: any): string => {
    if (!addr) return '';
    return [
      addr.StrtNm,
      addr.BldgNb,
      addr.PstCd,
      addr.TwnNm,
      addr.DstrctNm,
      addr.Ctry
    ].filter(Boolean).join(', ');
  };

  // Extract data for each credit transfer
  const rows: string[][] = [headers];
  const txInfo = transfer.CdtTrfTxInf;
  const grpHdr = transfer.GrpHdr;

  // Helper function to safely get nested value
  const getValue = (obj: any, path: string): string => {
    const value = path.split('.').reduce((acc, part) => acc?.[part], obj);
    return value?.toString() || '';
  };

  // Create row for each transaction
  const row = [
    getValue(grpHdr, 'MsgId'),
    getValue(grpHdr, 'CreDtTm'),
    getValue(grpHdr, 'NbOfTxs'),
    getValue(grpHdr, 'SttlmInf.SttlmMtd'),
    getValue(txInfo, 'PmtId.InstrId'),
    getValue(txInfo, 'PmtId.EndToEndId'),
    getValue(txInfo, 'PmtId.UETR'),
    getValue(txInfo, 'IntrBkSttlmAmt.#text'),
    getValue(txInfo, 'IntrBkSttlmAmt._Ccy'),
    getValue(txInfo, 'IntrBkSttlmDt'),
    getValue(txInfo, 'InstdAmt.#text'),
    getValue(txInfo, 'InstdAmt._Ccy'),
    getValue(txInfo, 'ChrgBr'),
    getValue(txInfo, 'InstgAgt.FinInstnId.BICFI'),
    getValue(txInfo, 'InstdAgt.FinInstnId.BICFI'),
    getValue(txInfo, 'IntrmyAgt1.FinInstnId.BICFI'),
    getValue(txInfo, 'IntrmyAgt1.FinInstnId.Nm'),
    formatAddress(getValue(txInfo, 'IntrmyAgt1.FinInstnId.PstlAdr')),
    getValue(txInfo, 'Dbtr.Nm'),
    formatAddress(getValue(txInfo, 'Dbtr.PstlAdr')),
    getValue(txInfo, 'DbtrAcct.Id.IBAN'),
    getValue(txInfo, 'DbtrAgt.FinInstnId.BICFI'),
    getValue(txInfo, 'CdtrAgt.FinInstnId.BICFI'),
    getValue(txInfo, 'CdtrAgt.FinInstnId.Nm'),
    formatAddress(getValue(txInfo, 'CdtrAgt.FinInstnId.PstlAdr')),
    getValue(txInfo, 'Cdtr.Nm'),
    formatAddress(getValue(txInfo, 'Cdtr.PstlAdr')),
    getValue(txInfo, 'CdtrAcct.Id.IBAN'),
    getValue(txInfo, 'Purp.Cd'),
    getValue(txInfo, 'RmtInf.Ustrd')
  ];

  rows.push(row);
  console.log("rows", rows);
  return rows;
};

export default function Home() {
  return (
    <div className={styles.page}>
      <DromoUploader 
        licenseKey=""  
        fileParsers={[
          {
            extensions: ["xml"],
            parseFile: xmlParser
          }
        ]}
        fields={[ 
          { label: "Message ID", key: "MsgId" },
          { label: "Creation Date/Time", key: "CreDtTm" },
          { label: "Number of Transactions", key: "NbOfTxs" },
          { label: "Settlement Method", key: "SttlmMtd" },
          { label: "Instruction ID", key: "InstrId" },
          { label: "End to End ID", key: "EndToEndId" },
          { label: "UETR", key: "UETR" },
          { label: "Interbank Settlement Amount", key: "IntrBkSttlmAmt" },
          { label: "Interbank Settlement Currency", key: "IntrBkSttlmAmt_Ccy" },
          { label: "Interbank Settlement Date", key: "IntrBkSttlmDt" },
          { label: "Instructed Amount", key: "InstdAmt" },
          { label: "Instructed Amount Currency", key: "InstdAmt_Ccy" },
          { label: "Charge Bearer", key: "ChrgBr" },
          { label: "Instructing Agent BICFI", key: "InstgAgt_BICFI" },
          { label: "Instructed Agent BICFI", key: "InstdAgt_BICFI" },
          { label: "Intermediary Agent 1 BICFI", key: "IntrmyAgt1_BICFI" },
          { label: "Intermediary Agent 1 Name", key: "IntrmyAgt1_Nm" },
          { label: "Intermediary Agent 1 Address", key: "IntrmyAgt1_Address" },
          { label: "Debtor Name", key: "Dbtr_Nm" },
          { label: "Debtor Address", key: "Dbtr_Address" },
          { label: "Debtor Account IBAN", key: "DbtrAcct_IBAN" },
          { label: "Debtor Agent BICFI", key: "DbtrAgt_BICFI" },
          { label: "Creditor Agent BICFI", key: "CdtrAgt_BICFI" },
          { label: "Creditor Agent Name", key: "CdtrAgt_Nm" },
          { label: "Creditor Agent Address", key: "CdtrAgt_Address" },
          { label: "Creditor Name", key: "Cdtr_Nm" },
          { label: "Creditor Address", key: "Cdtr_Address" },
          { label: "Creditor Account IBAN", key: "CdtrAcct_IBAN" },
          { label: "Purpose Code", key: "Purp_Cd" },
          { label: "Remittance Information Unstructured", key: "RmtInf_Ustrd" }
        ]} 
        settings={{ 
          importIdentifier: "XML" 
        }} 
        user={{ 
          id: "1", 
          name: "Jane Doe", 
          email: "jane@dromo.io", 
          companyId: "Dromo", 
          companyName: "12345" 
        }} 
        onResults={((response) => 
          console.log("Response:", response) 
        )} 
      > 
        Launch XML Parser 
      </DromoUploader>
      <DromoUploader 
        licenseKey=""  
        fileParsers={[
          {
            extensions: ["txt"],
            parseFile: txtParser
          }
        ]}
        fields={[
          { label: "Record Type", key: "RecordType" },
          { label: "Bank Code", key: "BankCode" },
          { label: "Desk Code", key: "DeskCode" },
          { label: "Currency Code", key: "CurrencyCode" },
          { label: "Account Number", key: "AccountNumber" },
        ]}
        settings={{ 
          importIdentifier: "TXT" 
        }} 
        user={{ 
          id: "1", 
          name: "Jane Doe", 
          email: "jane@dromo.io", 
          companyId: "Dromo", 
          companyName: "12345" 
        }} 
        onResults={((response) => 
          console.log("Response:", response) 
        )} 
      >
        Launch TXT Parser
      </DromoUploader>
    </div>
  );
}

