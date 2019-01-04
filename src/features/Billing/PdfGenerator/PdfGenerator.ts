import * as jsPDF from 'jspdf';
import { splitEvery } from 'ramda';
import formatDate from 'src/utilities/formatDate'
import LinodeLogo from './LinodeLogo';

const leftPadding = 15;
const baseFont = 'Times New Roman';
const tableBodyStart = 155;
const cellHeight = 25;

const renderDate = (v: null | string) => v ? formatDate(v, {format: `YYYY-MM-DD HH:mm:ss`}) : null;

const renderUnitPrice = (v: null | number) => v ? `$${v}` : null;

const renderQuantity = (v: null | number) => v ? v : null;

const addLeftHeader = (doc: jsPDF, page: number, pages: number, date: string | null) => {
  const addLine = (text: string, fontSize = 9) => {
    doc.text(text, leftPadding, currentLine, { charSpace: 0.75 });
    currentLine += fontSize;
  }

  let currentLine = 55;

  doc.setFontSize(9);
  doc.setFont(baseFont);

  addLine(`Page ${page} of ${pages}`);
  if (date) {
    addLine(`Invoice Date: ${date}`);
  }

  doc.setFontStyle('bold');
  addLine('Remit to:');
  doc.setFontStyle('normal');

  addLine(`Linode, LLC`);
  addLine('249 Arch St.');
  addLine('Philadelphia, PA 19106');
  addLine('USA');  
};

const addRightHeader = (doc: jsPDF, account: Linode.Account) => {
  const { address_1, address_2, city, company, country, first_name, last_name, state, zip } = account;

  const RightHeaderPadding = 300;

  const addLine = (text: string, fontSize = 9) => {
    doc.text(text, RightHeaderPadding, currentLine, { charSpace: 0.75 });
    currentLine += fontSize;
  }

  let currentLine = 55;

  doc.setFontSize(9);
  doc.setFont(baseFont);

  doc.setFontStyle('bold');
  addLine('Invoice To:');
  doc.setFontStyle('normal');


  addLine(`${first_name} ${last_name}`);
  addLine(`${company}`);
  addLine(`${address_1}`);
  if (address_2) {
    addLine(`${address_2}`);
  }
  addLine(`${city}, ${state}, ${zip}`);
  addLine(`${country}`);
};

const addFooter = (doc: jsPDF) => {
  const fontSize = 5;
  let currentLine = 600;

  const addLine = (text: string, customPadding: number) => {
    doc.text(text, customPadding, currentLine, { charSpace: 0.75, align: 'center' });
    currentLine += fontSize * 2;
  }

  doc.setFontSize(fontSize);
  doc.setFont(baseFont);

  // Second number argument - manual centering cos automatic doesn't work well
  addLine('249 Arch St. - Philadelphia, PA 19106', 210);
  addLine('USA', 220);
  addLine('P:855-4-LINODE (855-454-6633) F:609-380-7200 W:http://www.linode.com', 190);
};

const addTitle = (doc: jsPDF, title: string) => {
  doc.setFontSize(12);
  doc.setFontStyle('bold');
  doc.text(title, leftPadding, 130, { charSpace: 0.75 });
  // reset text format
  doc.setFontStyle('normal');
}

export const printInvoice = (account: Linode.Account, invoice: Linode.Invoice, items: Linode.InvoiceItem[]) => {

  const itemsPerPage = 18;
  const date = formatDate(invoice.date, {format: 'YYYY-MM-DD'});
  const invoiceId = invoice.id;
  const itemsChunks = items ? splitEvery(itemsPerPage, items) : [[]];
  const tableEnd = tableBodyStart + cellHeight * itemsChunks[itemsChunks.length - 1].length


  const doc = new jsPDF({
    unit: 'px'
  });

  const addTable = (itemsChunk: Linode.InvoiceItem[]) => {
    doc.setFontSize(10);

    const header = [
      {name: 'Description', prompt: 'Description', width: 250},
      {name: 'From', prompt: 'From', width: 72},
      {name: 'To', prompt: 'To', width: 72},
      {name: 'Quantity', prompt: 'Quantity', width: 52},
      {name: 'Units', prompt: 'Units', width: 52},
      {name: 'Amount', prompt: 'Amount', width: 52}
    ] as any[]; // assert type 'any' because per source code this is an extended and more advanced way of usage

    const itemRows = itemsChunk.map(item => {
      const { label, from, to, quantity, unit_price, amount } = item;
      return {
        Description: label.replace(' - ', ' - \n'), // Automatic line breaks don't work well. Doing it manually
        From: renderDate(from),
        To: renderDate(to),
        Quantity: renderQuantity(quantity),
        Units: renderUnitPrice(unit_price),
        Amount: '$' + amount
      }
    });

    // Place table header
    doc.table(leftPadding, 140, [], header, {
      fontSize: 10,
      printHeaders: true,
      autoSize: false,
      margins: {
        left: 15,
        top: 10,
        width: 800,
        bottom: 0
      }
    });

    // Place table body
    doc.table(leftPadding, tableBodyStart, itemRows, header, {
      fontSize: 9,
      printHeaders: false,
      autoSize: false,
      margins: {
        left: leftPadding,
        top: 10,
        width: 800,
        bottom: 0
      }
    });
  };

  const addTotalAmount = () => {
    doc.setFontSize(13);
    doc.setFontStyle('bold');
    // Empty line
    doc.cell(leftPadding, tableEnd, 412.5, 10, ' ', 1, 'left');
    // "Total" cell
    doc.cell(leftPadding, tableEnd + 10, 374, 20, 'Total:  ', 2, 'right');
    // Total value cell
    doc.cell(leftPadding + 300, tableEnd + 10, 38.5, 20, `$${Number(invoice.total).toFixed(2)}`, 2, 'left');
    // reset text format
    doc.setFontStyle('normal');
  };

  // Create a separate page for each set of invoice items
  itemsChunks.forEach((itemsChunk, index) => {
    doc.addImage(LinodeLogo, 'JPEG', 150, 5, 120, 50);
    addLeftHeader(doc, index + 1, itemsChunks.length, date);
    addRightHeader(doc, account);
    addTitle(doc, `Invoice: #${invoiceId}`);
    addTable(itemsChunk);
    addFooter(doc);
    if (index < itemsChunks.length - 1) {
      doc.addPage();
    }
  });

  addTotalAmount();
  
  doc.save(`invoice-${date}.pdf`);  

}

export const printPayment = (account: Linode.Account, payment: Linode.Payment) => {

  const date = formatDate(payment.date, {format: 'YYYY-MM-DD'});
  const paymentId = payment.id;
  const amount = payment.usd;
  const tableEnd = tableBodyStart + cellHeight;
  const doc = new jsPDF({
    unit: 'px'
  });

  const addTable = () => {
    doc.setFontSize(10);

    const header = [
      {name: 'Description', prompt: 'Description', width: 292},
      {name: 'Date', prompt: 'Date', width: 128},
      {name: 'Amount', prompt: 'Amount', width: 128}
    ] as any[]; // assert type 'any' because per source code this is an extended and more advanced way of usage

    const itemRows = [{
      Description: 'Payment. Thank you.', // Automatic line breaks don't work well. Doing it manually
      Date: renderDate(date),
      Amount: '$' + amount
    }]

    doc.table(leftPadding, 140, itemRows, header, {
      fontSize: 12,
      printHeaders: true,
      autoSize: false,
      margins: {
        left: 15,
        top: 10,
        width: 800,
        bottom: 0
      }
    });
  };

  const addTotalAmount = () => {
    doc.setFontSize(13);
    doc.setFontStyle('bold');
    // Empty line
    doc.cell(leftPadding, tableEnd, 411, 10, ' ', 1, 'left');
    // "Total" cell
    doc.cell(leftPadding, tableEnd + 10, 374, 20, 'Payment Total:    ', 2, 'right');
    // Total value cell
    doc.cell(leftPadding + 300, tableEnd + 10, 37, 20, `$${Number(amount).toFixed(2)}`, 2, 'left');
    // reset text format
    doc.setFontStyle('normal');
  };

// Create a separate page for each set of invoice items
  doc.addImage(LinodeLogo, 'JPEG', 150, 5, 120, 50);
  addLeftHeader(doc, 1, 1, date);
  addRightHeader(doc, account);
  addTitle(doc, `Receipt for Payment #${paymentId}`);
  addTable();
  addFooter(doc);
  addTotalAmount();
  
  doc.save(`payment-${date}.pdf`);  

}

