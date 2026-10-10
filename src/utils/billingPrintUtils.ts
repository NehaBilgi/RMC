import { RMCInvoice, DeliveryChallan, RMCOrder } from '../types/rmc';

export function printCorporateTaxInvoice(inv: RMCInvoice) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>TAX INVOICE - ${inv.invoiceNumber} - CONCRETE360 RMC</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a; margin: 0; background: #fff; font-size: 13px; line-height: 1.4; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .logo-text { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
          .logo-text span { color: #d97706; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .meta-cell { width: 50%; vertical-align: top; padding: 12px; border: 1px solid #cbd5e1; background: #f8fafc; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 6px; letter-spacing: 0.5px; }
          .item-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .item-table th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; border: 1px solid #0f172a; }
          .item-table td { padding: 9px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
          .item-table tr:nth-child(even) { background: #f8fafc; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .totals-table { width: 45%; margin-left: auto; border-collapse: collapse; margin-bottom: 24px; }
          .totals-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .grand-total { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; background: #fffbeb; }
          .notes-box { padding: 12px; background: #f1f5f9; border-left: 4px solid #d97706; margin-bottom: 24px; font-size: 11px; color: #334155; }
          .bank-details { width: 52%; vertical-align: top; padding: 12px; border: 1px solid #cbd5e1; font-size: 11px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sign-box { width: 220px; text-align: center; border-top: 1px dashed #64748b; padding-top: 6px; font-size: 11px; color: #475569; }
          @media print {
            body { padding: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 60%;">
              <div class="logo-text">CONCRETE<span>360</span> INFRASTRUCTURE LTD.</div>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">
                Commercial Ready-Mix Concrete Batching & Supply Division<br>
                Corporate Office: Plot 108, Industrial Expressway Corridor, Sector 62<br>
                Company GSTIN: <strong>27AAACC9988H1Z4</strong> | PAN: AAACC9988H | CIN: U26940DL2018PLC33948<br>
                Plant Location: <strong>${inv.batchPlantName}</strong>
              </div>
            </td>
            <td style="width: 40%; text-align: right; vertical-align: top;">
              <div style="font-size: 20px; font-weight: 800; color: #0f172a;">TAX INVOICE</div>
              <div style="font-size: 13px; font-weight: 700; color: #d97706; margin: 3px 0;">ORIGINAL FOR RECIPIENT</div>
              <div class="badge">STATUS: ${inv.paymentStatus.toUpperCase()}</div>
              <div style="margin-top: 8px; font-size: 12px;">
                <strong>Invoice No:</strong> ${inv.invoiceNumber}<br>
                <strong>Invoice Date:</strong> ${inv.invoiceDate}<br>
                <strong>Payment Due:</strong> ${inv.dueDate}<br>
                <strong>Order Ref:</strong> ${inv.orderNumber}
              </div>
            </td>
          </tr>
        </table>

        <table class="meta-table">
          <tr>
            <td class="meta-cell">
              <div class="section-title">BILLED TO (BUYER DETAILS):</div>
              <strong style="font-size: 14px;">${inv.customerName}</strong><br>
              ${inv.billingAddress}<br>
              <strong>GSTIN / Tax ID:</strong> <span style="font-family: monospace; font-weight: 700;">${inv.taxId}</span><br>
              <strong>Payment Terms:</strong> ${inv.paymentTerms}
            </td>
            <td class="meta-cell">
              <div class="section-title">DELIVERY / SITE DISPATCH DESTINATION:</div>
              <strong>Project:</strong> ${inv.projectName}<br>
              <strong>Site Address:</strong> ${inv.siteAddress}<br>
              <strong>HSN/SAC Code:</strong> ${inv.hsnSacCode}<br>
              <strong>Transit Mixers Billed:</strong> ${inv.transitMixerCount} Loads (${inv.billedVolumeM3} m³ total)
            </td>
          </tr>
        </table>

        <table class="item-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 38%;">Description of Goods / Services</th>
              <th class="text-center" style="width: 12%;">HSN/SAC</th>
              <th class="text-right" style="width: 12%;">Qty (m³)</th>
              <th class="text-right" style="width: 15%;">Unit Rate ($)</th>
              <th class="text-right" style="width: 18%;">Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">1</td>
              <td>
                <strong>Ready-Mix Concrete Grade: ${inv.mixGrade}</strong><br>
                <span style="font-size: 11px; color: #64748b;">
                  Batch delivery as per IS 4926 / ASTM C94 quality dockets
                </span>
              </td>
              <td class="text-center font-mono">38245010</td>
              <td class="text-right"><strong>${inv.billedVolumeM3.toFixed(2)}</strong></td>
              <td class="text-right">$${inv.baseRatePerM3.toLocaleString()}</td>
              <td class="text-right"><strong>$${inv.concreteAmount.toLocaleString()}</strong></td>
            </tr>

            ${inv.pumpingFee > 0 ? `
            <tr>
              <td class="text-center">2</td>
              <td>Concrete Pumping & Line Placement Charges</td>
              <td class="text-center font-mono">997312</td>
              <td class="text-right">${inv.billedVolumeM3.toFixed(2)}</td>
              <td class="text-right">-</td>
              <td class="text-right">$${inv.pumpingFee.toLocaleString()}</td>
            </tr>
            ` : ''}

            ${inv.freightHaulageFee > 0 ? `
            <tr>
              <td class="text-center">3</td>
              <td>Transit Mixer Haulage & Lead Surcharge</td>
              <td class="text-center font-mono">996511</td>
              <td class="text-right">${inv.billedVolumeM3.toFixed(2)}</td>
              <td class="text-right">-</td>
              <td class="text-right">$${inv.freightHaulageFee.toLocaleString()}</td>
            </tr>
            ` : ''}

            ${inv.admixtureSurcharge > 0 ? `
            <tr>
              <td class="text-center">4</td>
              <td>Special Performance Chemical Admixtures (Plasticizers/Retarders)</td>
              <td class="text-center font-mono">382440</td>
              <td class="text-right">${inv.billedVolumeM3.toFixed(2)}</td>
              <td class="text-right">-</td>
              <td class="text-right">$${inv.admixtureSurcharge.toLocaleString()}</td>
            </tr>
            ` : ''}

            ${inv.demurrageCharges > 0 ? `
            <tr>
              <td class="text-center">5</td>
              <td>Transit Mixer Detention / Demurrage (Waiting time >45 mins on site)</td>
              <td class="text-center font-mono">996511</td>
              <td class="text-right">1</td>
              <td class="text-right">$${inv.demurrageCharges.toLocaleString()}</td>
              <td class="text-right">$${inv.demurrageCharges.toLocaleString()}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="bank-details">
            <div class="section-title">COMPANY REMITTANCE BANK ACCOUNT:</div>
            <strong>Bank Name:</strong> Standard Chartered Commercial Banking<br>
            <strong>Account Name:</strong> CONCRETE360 INFRASTRUCTURE LTD<br>
            <strong>Account Number:</strong> 9920 4481 0029 3841<br>
            <strong>IFSC / Swift:</strong> SCBL0002841 | Branch: Expressway Central Hub<br>
            <div style="margin-top: 6px; color: #475569;">
              * Quote Invoice Number <strong>${inv.invoiceNumber}</strong> on payment advice remittance.
            </div>
          </div>

          <table class="totals-table">
            <tr>
              <td>Subtotal (Taxable Value):</td>
              <td class="text-right"><strong>$${inv.subtotal.toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td>CGST (${inv.cgstRatePercent}%):</td>
              <td class="text-right">$${inv.cgstAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td>SGST / UTGST (${inv.sgstRatePercent}%):</td>
              <td class="text-right">$${inv.sgstAmount.toLocaleString()}</td>
            </tr>
            <tr class="grand-total">
              <td><strong>TOTAL INVOICE AMOUNT:</strong></td>
              <td class="text-right"><strong>$${inv.grandTotal.toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td>Amount Paid:</td>
              <td class="text-right" style="color: #16a34a;"><strong>$${inv.paidAmount.toLocaleString()}</strong></td>
            </tr>
            <tr style="font-weight: 700; color: ${inv.balanceAmount > 0 ? '#b91c1c' : '#16a34a'};">
              <td>BALANCE PAYABLE:</td>
              <td class="text-right"><strong>$${inv.balanceAmount.toLocaleString()}</strong></td>
            </tr>
          </table>
        </div>

        <div class="notes-box">
          <strong>TERMS & STATUTORY DECLARATION:</strong><br>
          1. We declare that this invoice shows the actual price of the ready-mix concrete goods described and that all particulars are true and correct.<br>
          2. Certified delivery challans signed by the authorized site representative serve as conclusive evidence of volume and receipt.<br>
          3. Interest @ 18% per annum will be charged on all delayed bills beyond agreed credit terms.<br>
          4. Water added at site on customer's demand voids all compressive strength liability and test warranties.
        </div>

        <div class="signatures">
          <div class="sign-box">
            Customer / Receiver Signature & Stamp
          </div>
          <div class="sign-box">
            For <strong>CONCRETE360 INFRASTRUCTURE LTD</strong><br>
            <br>
            Authorized Corporate Signatory / CFO
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

export function printDeliveryChallanDocket(challan: DeliveryChallan, order?: RMCOrder) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>DELIVERY CHALLAN & BATCH TICKET - ${challan.challanNumber}</title>
        <style>
          body { font-family: monospace, sans-serif; padding: 24px; font-size: 12px; color: #1e293b; }
          .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: bold; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .box { border: 1px solid #000; padding: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          th { background: #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">CONCRETE360 - TRANSIT MIXER DELIVERY CHALLAN & BATCH TICKET</div>
          <div>Challan No: <b>${challan.challanNumber}</b> | Batch Time: <b>${challan.batchTimestamp}</b></div>
        </div>

        <div class="grid">
          <div class="box">
            <b>TRANSIT MIXER & DRIVER:</b><br>
            Truck: <b>${challan.mixerTruckNumber}</b><br>
            Driver: ${challan.driverName} (${challan.driverPhone})<br>
            Departure from Batch Plant: <b>${challan.siteDepartureTime}</b><br>
            Site Arrival: ${challan.siteArrivalTime || 'Pending'}
          </div>

          <div class="box">
            <b>BATCH WEIGHTS & QUANTITY:</b><br>
            Batch Volume: <b>${challan.batchVolumeM3} m³</b><br>
            Gross Weight: ${challan.grossWeightKg ? `${challan.grossWeightKg} kg` : 'N/A'}<br>
            Tare Weight: ${challan.tareWeightKg ? `${challan.tareWeightKg} kg` : 'N/A'}<br>
            Net Concrete: ${challan.netWeightKg ? `${challan.netWeightKg} kg` : 'N/A'}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>W/C Ratio</th>
              <th>Plant Slump</th>
              <th>Site Slump</th>
              <th>Water at Plant</th>
              <th>Water on Site</th>
              <th>Cube Samples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>${challan.waterCementRatio}</b></td>
              <td><b>${challan.slumpAtPlantMm} mm</b></td>
              <td>${challan.slumpAtSiteMm ? `${challan.slumpAtSiteMm} mm` : 'Tested on Site'}</td>
              <td>${challan.waterAddedAtPlantLiters} L</td>
              <td style="color: ${challan.siteWaterAdditionLiters > 0 ? 'red' : 'green'};">
                <b>${challan.siteWaterAdditionLiters} L</b>
              </td>
              <td>${challan.cubeSampleTaken ? `${challan.cubeSampleCount} cubes cast` : 'None'}</td>
            </tr>
          </tbody>
        </table>

        <div class="box" style="margin-top: 15px;">
          <b>SITE ACKNOWLEDGEMENT:</b><br>
          Received in good condition. Slump verified before discharge.<br>
          Receiver: <b>${challan.receiverName || 'Site Engineer'}</b><br>
          Signature: [ Verified Electronic Signoff ]
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}
