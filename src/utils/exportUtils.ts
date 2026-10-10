import { RMCOrder, SiteMeasurementSession } from '../types/rmc';

export function generateWhatsAppQuoteMessage(session: SiteMeasurementSession): string {
  const text = `🏗️ *CONCRETE360 READY-MIX CONCRETE QUOTATION*
----------------------------------------
*Project:* ${session.projectName}
*Contractor:* ${session.contractor}
*Site Location:* ${session.siteLocation}
*Date:* ${session.date}
*Prepared by:* ${session.salesRepName}

📐 *MEASUREMENT SUMMARY:*
• Net Structural Volume: ${session.totalNetM3} m³
• Safety Margin / Wastage (${session.safetyWastagePercent}%): ${(session.totalGrossM3 - session.totalNetM3).toFixed(1)} m³
• *Total Concrete Required:* *${session.totalGrossM3} m³*
• Recommended Mix: *${session.recommendedMixGrade}*
• Recommended Pour: *${session.recommendedPourType}*
• Estimated Transit Mixer Loads: *${session.requiredTruckLoads} trucks* (${session.transitTruckCapacityM3}m³ capacity)

📦 *ELEMENTS MEASURED:*
${session.structures.map((s, i) => `${i + 1}. ${s.name} (${s.type}): ${s.quantity} units -> ${s.calculatedNetVolumeM3} m³`).join('\n')}

For scheduling and instant batch plant booking, reply to this message or call our dispatch coordinator.`;

  return encodeURIComponent(text);
}

export function printOrderInvoice(order: RMCOrder) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>RMC Dispatch Delivery Order - ${order.orderNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; }
          .brand { font-size: 24px; font-weight: 800; color: #0f172a; }
          .badge { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 14px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 13px; border-bottom: 2px solid #cbd5e1; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .total-row { font-size: 16px; font-weight: 700; color: #0f172a; }
          .footer { margin-top: 40px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">CONCRETE360 READY-MIX CONCRETE</div>
            <div style="font-size: 13px; color: #64748b;">Automated Field Dispatch & Batching System</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 700;">${order.orderNumber}</div>
            <div class="badge">STATUS: ${order.status.toUpperCase()}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <strong>CUSTOMER & SITE DETAILS:</strong><br>
            Client: <b>${order.customerName}</b><br>
            Project: ${order.projectName}<br>
            Site Address: ${order.siteAddress}<br>
            Pour Location: <b>${order.pourLocationInStructure}</b><br>
            Contact: ${order.contactPerson} (${order.phone})
          </div>
          <div class="card">
            <strong>DISPATCH SCHEDULE:</strong><br>
            Batching Plant: <b>${order.batchPlantName}</b><br>
            Scheduled Pour: <b>${order.scheduledPourDate} at ${order.scheduledPourTime}</b><br>
            Pour Method: <b>${order.pourType}</b><br>
            Sales Rep: ${order.salesRepName}<br>
            Payment Terms: ${order.paymentTerms} (${order.creditApproved ? 'Credit Approved' : 'Pending'})
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Mix Grade</th>
              <th>Target Slump</th>
              <th>Agg. Size</th>
              <th>Admixtures</th>
              <th>Quantity</th>
              <th>Unit Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td><b>${item.mixGrade}</b></td>
                <td>${item.slumpTargetMm} mm</td>
                <td>${item.aggregateSizeMm} mm</td>
                <td>${item.admixtures.join(', ') || 'Standard'}</td>
                <td><b>${item.quantityM3} m³</b></td>
                <td>$${item.unitRatePerM3.toLocaleString()}</td>
                <td>$${item.totalMixPrice.toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr>
              <td colspan="6" style="text-align: right;">Pump Equipment Hire:</td>
              <td>$${order.pumpCharges.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align: right;">Freight & Haulage Surcharge:</td>
              <td>$${order.freightSurcharge.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align: right;">Special Admixture Charges:</td>
              <td>$${order.admixtureCharges.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align: right;">Subtotal:</td>
              <td>$${order.subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="6" style="text-align: right;">Tax / GST (18%):</td>
              <td>$${order.tax.toLocaleString()}</td>
            </tr>
            <tr class="total-row">
              <td colspan="6" style="text-align: right;">TOTAL ESTIMATE / INVOICE:</td>
              <td><b>$${order.totalAmount.toLocaleString()}</b></td>
            </tr>
          </tbody>
        </table>

        <div class="card" style="margin-top: 15px;">
          <strong>QUALITY & SITE NOTES:</strong><br>
          • Target 28-day Compressive Strength: <b>${order.cubeStrengthTargetMPa} MPa</b><br>
          • Delivery Volume: ${order.deliveredVolumeM3} m³ of ${order.totalVolumeM3} m³ poured (${Math.round((order.deliveredVolumeM3 / order.totalVolumeM3) * 100)}% complete)<br>
          • Instructions: ${order.notes || 'No special remarks.'}
        </div>

        <div class="footer">
          Concrete slump retention valid for 90 minutes from batching timestamp. Uncontrolled water addition on site voids all compressive strength warranties.
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
