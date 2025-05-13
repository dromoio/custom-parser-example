"use client";

import { XMLParser } from "fast-xml-parser";
import styles from "./page.module.css";
import DromoUploader from "dromo-uploader-react";

const parseMT101 = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split(/\r?\n/);

  // Define column mappings (human-readable names)
  const mt101Columns = [
    { label: "Sender's Reference", key: "20" },
    { label: "Customer Specified Reference", key: "21R" },
    { label: "Transaction Reference", key: "21" },
    { label: "F/X Deal Reference", key: "21F" },
    { label: "Instruction Code", key: "23E" },
    { label: "Account Identification", key: "25" },
    { label: "Statement Number / Sequence Number", key: "28D" },
    { label: "Requested Execution Date", key: "30" },
    { label: "Amount & Currency", key: "32B" },
    { label: "Ordering Customer (A)", key: "50A" },
    { label: "Ordering Customer (F)", key: "50F" },
    { label: "Ordering Customer (H)", key: "50H" },
    { label: "Ordering Institution (A)", key: "52A" },
    { label: "Ordering Institution (D)", key: "52D" },
    { label: "Sender's Correspondent (A)", key: "53A" },
    { label: "Sender's Correspondent (B)", key: "53B" },
    { label: "Sender's Correspondent (D)", key: "53D" },
    { label: "Receiver's Correspondent (A)", key: "54A" },
    { label: "Receiver's Correspondent (B)", key: "54B" },
    { label: "Receiver's Correspondent (D)", key: "54D" },
    { label: "Third Reimbursement Institution (A)", key: "55A" },
    { label: "Third Reimbursement Institution (B)", key: "55B" },
    { label: "Third Reimbursement Institution (D)", key: "55D" },
    { label: "Intermediary Institution (A)", key: "56A" },
    { label: "Intermediary Institution (C)", key: "56C" },
    { label: "Intermediary Institution (D)", key: "56D" },
    { label: "Account With Institution (A)", key: "57A" },
    { label: "Account With Institution (B)", key: "57B" },
    { label: "Account With Institution (D)", key: "57D" },
    { label: "Beneficiary Customer", key: "59" },
    { label: "Beneficiary Customer (F)", key: "59F" },
    { label: "Remittance Information", key: "70" },
    { label: "Details of Charges", key: "71A" },
    { label: "Sender's Charges", key: "71F" },
    { label: "Receiver's Charges", key: "71G" },
    { label: "Bank to Bank Information", key: "72" },
    { label: "Regulatory Reporting", key: "77B" },
    { label: "Envelope Contents", key: "77T" },
    { label: "MPH Bank Name", key: "MPH01" },
    { label: "MPH Account Number", key: "MPH02" },
    { label: "MPH SWIFT Code", key: "MPH03" },
    { label: "MPH Address Line 1", key: "MPH04" },
    { label: "MPH Address Line 2", key: "MPH05" },
    { label: "MPH Address Line 3", key: "MPH06" },
    { label: "MPH Country", key: "MPH07" },
  ];

  const transactions: string[][] = [];
  transactions.push(mt101Columns.map((col) => col.label)); // Add human-readable headers

  let currentTransaction: Record<string, string> = {};
  let lastTag = "";

  for (const line of lines) {
    const match = line.match(/^:(\d{2}[A-Z0-9]*?):(.*)/);

    if (match) {
      const [, tag, value] = match;

      // If we encounter a new ":21:" transaction reference, save the previous transaction
      if (tag === "21" && Object.keys(currentTransaction).length > 0) {
        transactions.push(
          mt101Columns.map((col) => currentTransaction[col.key] || "")
        );
        currentTransaction = {};
      }

      // Map raw tag to human-readable key
      if (mt101Columns.some((col) => col.key === tag)) {
        currentTransaction[tag] = value.trim();
        lastTag = tag;
      }
    } else if (lastTag) {
      // Append multiline fields to the last tag
      currentTransaction[lastTag] += ` ${line.trim()}`;
    }
  }

  // Add the last transaction
  if (Object.keys(currentTransaction).length > 0) {
    transactions.push(
      mt101Columns.map((col) => currentTransaction[col.key] || "")
    );
  }

  return transactions;
};

const txtParser = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(buffer);
  const lines = text.split("\n").filter((line) => line.trim());

  // Define headers based on the CFONB format fields
  const headers = [
    "RecordType",
    "BankCode",
    "DeskCode",
    "CurrencyCode",
    "AccountNumber",
    "BeneficiaryName",
    "BeneficiaryAddress1",
    "BeneficiaryAddress2",
    "BeneficiaryAddress3",
    "Amount",
    "OperationCode",
    "OperationDate",
    "Currency",
    "Reference",
    "BankDetails",
  ];

  const rows: string[][] = [headers];

  // Process each line
  lines.forEach((line) => {
    const recordType = line.substring(0, 2);

    // Only process transaction records (type 04)
    if (recordType === "04") {
      const row = [
        recordType,
        line.substring(2, 7), // Bank code
        line.substring(7, 11), // Desk code
        line.substring(11, 14), // Currency code
        line.substring(14, 39).trim(), // Account number
        line.substring(39, 79).trim(), // Beneficiary name
        line.substring(79, 119).trim(), // Address line 1
        line.substring(119, 159).trim(), // Address line 2
        line.substring(159, 199).trim(), // Address line 3
        line.substring(199, 214).trim(), // Amount
        line.substring(214, 217), // Operation code
        line.substring(217, 223), // Operation date
        line.substring(223, 226), // Currency
        line.substring(226, 241).trim(), // Reference
        line.substring(241).trim(), // Bank details
      ];
      rows.push(row);
    }
  });

  return rows;
};

const xmlParser = async (buffer: ArrayBuffer): Promise<string[][]> => {
  console.log("buffer", buffer);

  const decoder = new TextDecoder("utf-8");
  const xmlString = decoder.decode(buffer);

  // Configure and create parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
    // Ensure that numeric strings are not converted to numbers automatically
    parseTagValue: false,
    parseAttributeValue: false,
  });

  // Parse XML to JSON
  const result = parser.parse(xmlString);

  // Define a type for the row structure in AD-XML.xml for better type safety
  interface AdXmlRow {
    beneID?: string;
    beneName?: string;
    ref?: string;
    totalAmount?: string;
    // Add other potential fields from row if they exist and are needed
  }

  // Detect if this is the AD Payment XML (root/row structure) or the ISO20022 XML handled previously.
  if (result.root && Array.isArray(result.root.row)) {
    // ------------------------
    // AD PAYMENT XML HANDLING
    // ------------------------
    const paymentHeaders = [
      "BeneficiaryID",
      "BeneName",
      "Ref1",
      "Currency",
      "Amount",
    ];

    const rows: string[][] = [paymentHeaders];

    const rowNodes: AdXmlRow[] = result.root.row;

    rowNodes.forEach((r: AdXmlRow) => {
      const beneID = r.beneID ?? "";
      const totalAmountStr = r.totalAmount ?? "0"; // Default to "0" if null/undefined to ensure parseFloat works
      const totalAmount = parseFloat(totalAmountStr);

      // XSLT condition: beneID != '' and totalAmount > 0
      if (beneID && !Number.isNaN(totalAmount) && totalAmount > 0) {
        rows.push([
          beneID,
          r.beneName ?? "",
          r.ref ?? "",
          "USD", // hard-coded as per XSLT
          totalAmountStr,
        ]);
      }
    });

    return rows;
  }

  // ---------------------------------------------------------
  // Existing ISO20022 pacs.008 handling remains unchanged below
  // ---------------------------------------------------------

  // Ensure Document and FIToFICstmrCdtTrf exist before trying to access them
  if (!result.Document || !result.Document.FIToFICstmrCdtTrf) {
    console.error(
      "XML structure does not match expected ISO20022 pain.001.001.03 (pacs.008) or AD-XML format.",
      result
    );
    // Return empty array or headers only, depending on desired error handling for Dromo
    return [["Error"], ["Unrecognized XML structure"]];
  }

  const transfer = result.Document.FIToFICstmrCdtTrf;

  // Define headers for ISO20022 pain.001.001.03 (pacs.008) output
  // These are the original headers + the two demonstration columns
  const isoHeaders = [
    "MsgId",
    "CreDtTm",
    "NbOfTxs",
    "SttlmMtd",
    "InstrId",
    "EndToEndId",
    "UETR",
    "IntrBkSttlmAmt",
    "IntrBkSttlmAmt_Ccy",
    "IntrBkSttlmDt",
    "InstdAmt",
    "InstdAmt_Ccy",
    "ChrgBr",
    "InstgAgt_BICFI",
    "InstdAgt_BICFI",
    "IntrmyAgt1_BICFI",
    "IntrmyAgt1_Nm",
    "IntrmyAgt1_Address",
    "Dbtr_Nm",
    "Dbtr_Address",
    "DbtrAcct_IBAN",
    "DbtrAgt_BICFI",
    "CdtrAgt_BICFI",
    "CdtrAgt_Nm",
    "CdtrAgt_Address",
    "Cdtr_Nm",
    "Cdtr_Address",
    "CdtrAcct_IBAN",
    "Purp_Cd",
    "RmtInf_Ustrd",
    // ------------------------------------------------------------------
    // The following columns are purely for demonstration purposes. In a real
    // migration these keys would be produced by translating the FX360 XSLT
    // transformation logic into JavaScript. They show *where* the derived
    // values would be surfaced in Dromo.
    // ------------------------------------------------------------------
    "Transformed_Amount",
    "Conditional_Field",
  ];

  const rows: string[][] = [isoHeaders];

  // Helper function to format address
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatAddress = (addr: any): string => {
    if (!addr) return "";
    return [
      addr.StrtNm,
      addr.BldgNb,
      addr.PstCd,
      addr.TwnNm,
      addr.DstrctNm,
      addr.Ctry,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // Helper function to safely get nested value

  const getValue = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj: any,
    path: string,
    defaultValue: string = ""
  ): string => {
    const value = path.split(".").reduce((acc, part) => acc?.[part], obj);
    // Ensure that if value is a number (e.g. from XML auto-parsing if not disabled),
    // it's converted to string. Also handle null/undefined by returning default.
    if (value === null || typeof value === "undefined") {
      return defaultValue;
    }
    return value.toString();
  };

  // -------------------------------------------------------------
  // START: XSLT-LOGIC PLACEHOLDER SECTION
  // -------------------------------------------------------------
  // The FX360 flow may contain **multiple** <CdtTrfTxInf> nodes. The original
  // version of this sample only handled a single transaction.  Here we first
  // normalise the data into an array so we can iterate over *each* record and
  // apply any translation rules that would normally live in the XSLT.
  //
  // NOTE:  All examples below are *hypothetical*. They illustrate how XSLT
  // constructs such as <xsl:if>, <xsl:choose>, mathematical calculations or
  // even customer-specific rules could be expressed in JavaScript.  You **must**
  // replace these placeholders with the real rules once they have been
  // extracted from the Convera templates.
  // -------------------------------------------------------------

  const transactions = Array.isArray(transfer.CdtTrfTxInf)
    ? transfer.CdtTrfTxInf
    : transfer.CdtTrfTxInf
    ? [transfer.CdtTrfTxInf]
    : []; // Ensure CdtTrfTxInf exists

  for (const transaction of transactions) {
    // Example of sourcing raw values from the parsed XML structure
    const originalAmount = getValue(transaction, "IntrBkSttlmAmt.#text", "0"); // Default to "0" for calculations
    const currency = getValue(transaction, "IntrBkSttlmAmt._Ccy");
    const purposeCode = getValue(transaction, "Purp.Cd");

    // ------------------------
    // Hypothetical rule set 1
    // ------------------------
    // Example: Apply a 1.05 uplift for USD payments
    // <xsl:if test="IntrBkSttlmAmt/@Ccy = 'USD'">Amount * 1.05</xsl:if>
    let transformedAmount = originalAmount;
    if (currency === "USD") {
      const parsed = parseFloat(originalAmount);
      if (!Number.isNaN(parsed)) {
        transformedAmount = (parsed * 1.05).toFixed(2);
      }
    }

    // ------------------------
    // Hypothetical rule set 2
    // ------------------------
    // Example: Map purpose codes to a human friendly description similar to:
    // <xsl:choose>
    //   <xsl:when test="Purp/Cd = 'FEES'">Processing Fee</xsl:when>
    //   <xsl:otherwise>Standard Payment</xsl:otherwise>
    // </xsl:choose>
    const conditionalField =
      purposeCode === "FEES" ? "Processing Fee" : "Standard Payment";

    // ------------------------
    // Hypothetical rule set 3 (customer-specific)
    // ------------------------
    // Real FX360 XSLT often contains branches that only execute for particular
    // corporate customers.  This would typically rely on a customer identifier
    // somewhere in the file (e.g. <PtyId>).  For the purposes of this demo we
    // simply leave a marker here:
    //
    //   if (customerId === 'Convera-Sample-Corp') {
    //       // special handling ...
    //   }

    // Construct the final row.  We reuse shared header info from <GrpHdr> and
    // merge in the transaction-specific data plus our demonstration columns.
    const row = [
      getValue(transfer.GrpHdr, "MsgId"),
      getValue(transfer.GrpHdr, "CreDtTm"),
      getValue(transfer.GrpHdr, "NbOfTxs"),
      getValue(transfer.GrpHdr, "SttlmInf.SttlmMtd"),
      getValue(transaction, "PmtId.InstrId"),
      getValue(transaction, "PmtId.EndToEndId"),
      getValue(transaction, "PmtId.UETR"),
      originalAmount,
      currency,
      getValue(transaction, "IntrBkSttlmDt"),
      getValue(transaction, "InstdAmt.#text"),
      getValue(transaction, "InstdAmt._Ccy"),
      getValue(transaction, "ChrgBr"),
      getValue(transaction, "InstgAgt.FinInstnId.BICFI"),
      getValue(transaction, "InstdAgt.FinInstnId.BICFI"),
      getValue(transaction, "IntrmyAgt1.FinInstnId.BICFI"),
      getValue(transaction, "IntrmyAgt1.FinInstnId.Nm"),
      formatAddress(getValue(transaction, "IntrmyAgt1.FinInstnId.PstlAdr")),
      getValue(transaction, "Dbtr.Nm"),
      formatAddress(getValue(transaction, "Dbtr.PstlAdr")),
      getValue(transaction, "DbtrAcct.Id.IBAN"),
      getValue(transaction, "DbtrAgt.FinInstnId.BICFI"),
      getValue(transaction, "CdtrAgt.FinInstnId.BICFI"),
      getValue(transaction, "CdtrAgt.FinInstnId.Nm"),
      formatAddress(getValue(transaction, "CdtrAgt.FinInstnId.PstlAdr")),
      getValue(transaction, "Cdtr.Nm"),
      formatAddress(getValue(transaction, "Cdtr.PstlAdr")),
      getValue(transaction, "CdtrAcct.Id.IBAN"),
      purposeCode,
      getValue(transaction, "RmtInf.Ustrd"),
      // Demonstration columns
      transformedAmount,
      conditionalField,
    ];

    rows.push(row);
  }

  // -------------------------------------------------------------
  // END: XSLT-LOGIC PLACEHOLDER SECTION
  // -------------------------------------------------------------

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
            parseFile: xmlParser,
          },
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
          { label: "Remittance Information Unstructured", key: "RmtInf_Ustrd" },
          // The next two field definitions correspond to the demonstration
          // transformation columns added above. They are NOT part of the Convera AD-XML transformation
          // but are kept for the ISO20022 path to show where such logic would live.
          // For AD-XML, these will effectively be blank or not present if not explicitly added.
          { label: "Transformed Amount", key: "Transformed_Amount" },
          { label: "Conditional Field", key: "Conditional_Field" },
        ]}
        settings={{
          importIdentifier: "XML",
        }}
        user={{
          id: "1",
          name: "Jane Doe",
          email: "jane@dromo.io",
          companyId: "Dromo",
          companyName: "12345",
        }}
        onResults={(response) => console.log("Response:", response)}
      >
        Launch XML Parser
      </DromoUploader>
      <DromoUploader
        licenseKey=""
        fileParsers={[
          {
            extensions: ["txt"],
            parseFile: txtParser,
          },
        ]}
        fields={[
          { label: "Record Type", key: "RecordType" },
          { label: "Bank Code", key: "BankCode" },
          { label: "Desk Code", key: "DeskCode" },
          { label: "Currency Code", key: "CurrencyCode" },
          { label: "Account Number", key: "AccountNumber" },
        ]}
        settings={{
          importIdentifier: "TXT",
        }}
        user={{
          id: "1",
          name: "Jane Doe",
          email: "jane@dromo.io",
          companyId: "Dromo",
          companyName: "12345",
        }}
        onResults={(response) => console.log("Response:", response)}
      >
        Launch TXT Parser
      </DromoUploader>
      <DromoUploader
        licenseKey=""
        fileParsers={[
          {
            extensions: ["txt"],
            parseFile: parseMT101,
          },
        ]}
        fields={[
          { label: "Transaction Index", key: "TransactionIndex" },
          { label: "Sender's Reference", key: "20" },
          { label: "Customer Specified Reference", key: "21R" },
          { label: "Transaction Reference", key: "21" },
          { label: "F/X Deal Reference", key: "21F" },
          { label: "Instruction Code", key: "23E" },
          { label: "Account Identification", key: "25" },
          { label: "Statement Number / Sequence Number", key: "28D" },
          { label: "Requested Execution Date", key: "30" },
          { label: "Amount & Currency", key: "32B" },
          { label: "Ordering Customer (A)", key: "50A" },
          { label: "Ordering Customer (F)", key: "50F" },
          { label: "Ordering Customer (H)", key: "50H" },
          { label: "Ordering Institution (A)", key: "52A" },
          { label: "Ordering Institution (D)", key: "52D" },
          { label: "Sender's Correspondent (A)", key: "53A" },
          { label: "Sender's Correspondent (B)", key: "53B" },
          { label: "Sender's Correspondent (D)", key: "53D" },
          { label: "Receiver's Correspondent (A)", key: "54A" },
          { label: "Receiver's Correspondent (B)", key: "54B" },
          { label: "Receiver's Correspondent (D)", key: "54D" },
          { label: "Third Reimbursement Institution (A)", key: "55A" },
          { label: "Third Reimbursement Institution (B)", key: "55B" },
          { label: "Third Reimbursement Institution (D)", key: "55D" },
          { label: "Intermediary Institution (A)", key: "56A" },
          { label: "Intermediary Institution (C)", key: "56C" },
          { label: "Intermediary I  nstitution (D)", key: "56D" },
          { label: "Account With Institution (A)", key: "57A" },
          { label: "Account With Institution (B)", key: "57B" },
          { label: "Account With Institution (D)", key: "57D" },
          { label: "Beneficiary Customer", key: "59" },
          { label: "Beneficiary Customer (F)", key: "59F" },
          { label: "Remittance Information", key: "70" },
          { label: "Details of Charges", key: "71A" },
          { label: "Sender's Charges", key: "71F" },
          { label: "Receiver's Charges", key: "71G" },
          { label: "Bank to Bank Information", key: "72" },
          { label: "Regulatory Reporting", key: "77B" },
          { label: "Envelope Contents", key: "77T" },
          { label: "MPH Bank Name", key: "MPH01" },
          { label: "MPH Account Number", key: "MPH02" },
          { label: "MPH SWIFT Code", key: "MPH03" },
          { label: "MPH Address Line 1", key: "MPH04" },
          { label: "MPH Address Line 2", key: "MPH05" },
          { label: "MPH Address Line 3", key: "MPH06" },
          { label: "MPH Country", key: "MPH07" },
        ]}
        settings={{
          importIdentifier: "TXT",
        }}
        user={{
          id: "1",
          name: "Jane Doe",
          email: "jane@dromo.io",
          companyId: "Dromo",
          companyName: "12345",
        }}
        onResults={(response) => console.log("Response:", response)}
      >
        Launch M101 TXT Parser
      </DromoUploader>
    </div>
  );
}
