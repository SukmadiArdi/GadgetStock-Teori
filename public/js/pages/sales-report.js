import { ReportsAPI } from '/js/api.js';
import { formatRupiah, formatDate, todayISO } from '/js/utils.js';

document.getElementById('report-date').value = todayISO();

function formatRupiahCompact(value) {
  if (value >= 1000000) {
    return 'Rp ' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + ' Jt';
  } else if (value >= 1000) {
    return 'Rp ' + (value / 1000).toFixed(0) + ' Rb';
  }
  return 'Rp ' + value;
}

let currentReportData = null;

async function loadReport() {
  window.loadReport = loadReport;
  const date = document.getElementById('report-date').value || todayISO();
  try {
    const data = await ReportsAPI.daily(date);
    currentReportData = data;
    const { totalRevenue, totalOrders, avgOrderValue, totalItemsSold } = data.summary;

    document.getElementById('r-revenue').textContent = formatRupiah(totalRevenue);
    document.getElementById('r-orders').textContent  = totalOrders;
    document.getElementById('r-avg').textContent     = formatRupiah(avgOrderValue);
    document.getElementById('r-items').textContent   = totalItemsSold;

    // === Hourly chart (Enhanced) ==================================
    const maxRev = Math.max(...data.hourly.map(h=>h.revenue), 1);
    const peakHours = Array.from({length: 16}, (_, i) => i + 7); // 07:00 to 22:00
    const chartDiv = document.getElementById('hourly-chart');
    const labelDiv = document.getElementById('hour-labels');
    
    const filteredHours = data.hourly.filter(h => peakHours.includes(h.hour));
    
    // Find peak hour and quietest hour (from filteredHours)
    let peakHour = null;
    let peakRev = -1;
    let peakOrders = 0;
    
    let quietHour = null;
    let quietRev = Infinity;
    let quietOrders = 0;
    
    filteredHours.forEach(h => {
      if (h.revenue > peakRev) {
        peakRev = h.revenue;
        peakHour = h.hour;
        peakOrders = h.orders || 0;
      }
      if (h.revenue > 0 && h.revenue < quietRev) {
        quietRev = h.revenue;
        quietHour = h.hour;
        quietOrders = h.orders || 0;
      }
    });
    
    if (quietRev === Infinity) {
      quietRev = 0;
      quietHour = '-';
      quietOrders = 0;
    }

    // Populate Y-Axis labels
    const yAxisEl = document.getElementById('chart-y-axis');
    if (yAxisEl) {
      yAxisEl.innerHTML = `
        <span>${formatRupiahCompact(maxRev)}</span>
        <span>${formatRupiahCompact(Math.round(maxRev * 0.66))}</span>
        <span>${formatRupiahCompact(Math.round(maxRev * 0.33))}</span>
        <span>Rp 0</span>
      `;
    }

    // Render Bars
    chartDiv.innerHTML = filteredHours.map(h => {
      const pct = Math.max(2, (h.revenue / maxRev) * 100);
      const isActive = h.revenue > 0;
      const isPeak = h.hour === peakHour && isActive;
      
      let barClass = 'chart-bar chart-bar-empty';
      let styleString = `height:${pct}%;`;
      
      if (isActive) {
        if (isPeak) {
          barClass = 'chart-bar chart-bar-peak';
        } else {
          barClass = 'chart-bar chart-bar-active';
        }
      }
      
      return `<div 
        class="${barClass}" 
        style="${styleString}"
        data-hour="${h.hour}"
        data-label="${h.label}"
        data-revenue="${h.revenue}"
        data-orders="${h.orders || 0}"
      ></div>`;
    }).join('');

    // Setup interactive tooltip
    const tooltip = document.getElementById('chart-tooltip');
    const bars = chartDiv.querySelectorAll('.chart-bar');
    
    bars.forEach(bar => {
      bar.addEventListener('pointermove', (e) => {
        const label = bar.getAttribute('data-label');
        const revenue = parseFloat(bar.getAttribute('data-revenue'));
        const orders = bar.getAttribute('data-orders');
        
        tooltip.innerHTML = `
          <div class="chart-tooltip-date">Pukul ${label}</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Pendapatan:</span>
            <span class="chart-tooltip-value" style="color:#4ade80;">${formatRupiah(revenue)}</span>
          </div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-label">Transaksi:</span>
            <span class="chart-tooltip-value" style="color:#60a5fa;">${orders} pesanan</span>
          </div>
        `;
        
        // Dynamically compute tooltip size to eliminate offsets and hardcoded coordinates
        const rect = tooltip.getBoundingClientRect();
        const tooltipWidth = rect.width || 180;
        const tooltipHeight = rect.height || 75;
        
        // Center horizontally and bound within viewport borders
        const leftPos = Math.max(10, Math.min(e.clientX - tooltipWidth / 2, window.innerWidth - tooltipWidth - 10));
        // Position exactly 12px above the mouse pointer
        const topPos = e.clientY - tooltipHeight - 12;
        
        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
        tooltip.classList.add('visible');
      });
      
      bar.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });
    });

    // Hide tooltip when clicking or tapping away outside chart bars
    const hideTooltip = () => {
      tooltip.classList.remove('visible');
    };

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.chart-bar')) {
        hideTooltip();
      }
    }, { passive: true });

    // Populate X-Axis labels
    labelDiv.innerHTML = filteredHours.map((h, i) =>
      `<div style="flex:1;font-size:0.625rem;text-align:center;color:var(--on-surface-variant);font-weight:600;">${h.hour % 2 === 0 || i === 0 || i === filteredHours.length-1 ? String(h.hour).padStart(2,'0') + ':00' : ''}</div>`
    ).join('');

    // Populate Dynamic Insights Cards
    const insightsEl = document.getElementById('hourly-insights');
    if (insightsEl) {
      insightsEl.innerHTML = `
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(16, 185, 129, 0.15); color:#10b981;">
            <span class="material-symbols-outlined">trending_up</span>
          </div>
          <div class="insight-info">
            <span class="insight-label">Jam Puncak (Peak Hour)</span>
            <span class="insight-val text-rupiah">${formatRupiah(peakRev)}</span>
            <span class="insight-subtext">Pukul ${String(peakHour).padStart(2,'0')}:00 (${peakOrders} Transaksi)</span>
          </div>
        </div>
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(96, 165, 250, 0.15); color:#60a5fa;">
            <span class="material-symbols-outlined">hotel</span>
          </div>
          <div class="insight-info">
            <span class="insight-label">Jam Tersepi (Quiet Hour)</span>
            <span class="insight-val text-rupiah">${quietRev > 0 ? formatRupiah(quietRev) : 'Tidak ada omzet'}</span>
            <span class="insight-subtext">Pukul ${quietHour !== '-' ? String(quietHour).padStart(2,'0') + ':00' : '-'} ${quietRev > 0 ? `(${quietOrders} Transaksi)` : ''}</span>
          </div>
        </div>
      `;
    }

    // Top products
    const topDiv = document.getElementById('top-products');
    if (!data.topProducts.length) { topDiv.innerHTML = `<p style="color:var(--outline);font-size:0.875rem;">No sales data</p>`; }
    else {
      const maxRev2 = data.topProducts[0].revenue;
      topDiv.innerHTML = data.topProducts.map((p,i) => `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span style="font-size:0.75rem;font-weight:700;color:var(--on-surface-variant);width:1rem;text-align:center;">${i+1}</span>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:0.25rem;">
              <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:10rem;">${p.name}</span>
              <span style="font-weight:700;" class="text-rupiah">${formatRupiah(p.revenue)}</span>
            </div>
            <div style="height:0.375rem;background:var(--surface-container-high);border-radius:9999px;overflow:hidden;">
              <div style="height:100%;width:${(p.revenue/maxRev2*100).toFixed(0)}%;background:var(--primary-container);border-radius:9999px;"></div>
            </div>
          </div>
          <span style="font-size:0.75rem;color:var(--on-surface-variant);">×${p.qty}</span>
        </div>`).join('');
    }

    // Transactions table pagination
    const txnLimit = 5;
    let txnPage = 1;
    const methodIcons = { cash:'payments', qris:'qr_code_scanner', debit:'credit_card', credit:'credit_score' };

    window.renderTxnPage = (page) => {
      txnPage = page;
      const start = (txnPage - 1) * txnLimit;
      const end = start + txnLimit;
      const pageTxns = data.transactions.slice(start, end);
      const totalPages = Math.ceil(data.transactions.length / txnLimit);

      const tbody = document.getElementById('report-txn-tbody');
      tbody.innerHTML = pageTxns.map(t => {
        const items = (t.transaction_items||[]);
        const itemSummary = items.length > 0 ? `${items.length} item${items.length>1?'s':''}` : '—';
        const methodIcon  = methodIcons[t.payment_method] || 'payments';
        const statusColor = t.status === 'completed' ? '#15803d' : t.status === 'voided' ? 'var(--error)' : '#b45309';
        
        return `<tr>
          <td><span style="font-family:monospace;font-size:0.75rem;font-weight:700;color:var(--text-blue);">${t.txn_number}</span></td>
          <td style="font-size:0.8125rem;">${formatDate(t.created_at,'time')}</td>
          <td style="font-size:0.8125rem;">${t.customer_name||'Walk-in'}</td>
          <td style="font-size:0.8125rem;color:var(--on-surface-variant);text-align:center;">${itemSummary}</td>
          <td style="text-align:right;font-weight:700;" class="text-rupiah">${formatRupiah(t.total)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;text-transform:capitalize;">
              <span class="material-symbols-outlined" style="font-size:1rem;color:var(--on-surface-variant);">${methodIcon}</span>
              ${t.payment_method||'—'}
            </div>
          </td>
          <td style="text-align:center;">
            <span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.6875rem;font-weight:700;text-transform:uppercase;color:${statusColor};background:${statusColor}15;padding:0.25rem 0.625rem;border-radius:var(--radius-full);">
              <span class="material-symbols-outlined" style="font-size:0.875rem;">${t.status==='completed'?'check_circle':t.status==='voided'?'cancel':'pending'}</span>
              ${t.status}
            </span>
          </td>
        </tr>`;
      }).join('');

      document.getElementById('report-pag-info').textContent = `Page ${txnPage} of ${totalPages}`;
      
      const pagCtrl = document.getElementById('report-pag-ctrl');
      const pagWrap = document.getElementById('report-pagination');
      
      if (totalPages > 1) {
        pagWrap.style.display = 'flex';
        pagCtrl.innerHTML = `
          <button class="page-btn" onclick="renderTxnPage(${txnPage-1})" ${txnPage<=1?'disabled':''}>
            <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_left</span>
          </button>
          <span class="page-btn active">${txnPage}</span>
          <button class="page-btn" onclick="renderTxnPage(${txnPage+1})" ${txnPage>=totalPages?'disabled':''}>
            <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_right</span>
          </button>`;
      } else {
        pagWrap.style.display = 'none';
      }
    };

    if (!data.transactions.length) {
      document.getElementById('report-txn-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--outline);">No transactions on this date</td></tr>`;
      document.getElementById('report-pagination').style.display = 'none';
      document.getElementById('report-pag-info').textContent = '';
    } else {
      renderTxnPage(1);
    }
  } catch (err) {
    document.getElementById('r-revenue').textContent = formatRupiah(0);
    document.getElementById('report-txn-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--error);">${err.message}</td></tr>`;
  }
}

window.exportExcel = async function() {
  if (!currentReportData || !currentReportData.transactions.length) return alert('No data to export');
  
  const btn = document.getElementById('btn-export-sales');
  const oldHTML = btn.innerHTML;
  btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem;">hourglass_empty</span>Loading...`;
  
  try {
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const data = currentReportData.transactions.map(t => ({
      'TXN Number': t.txn_number,
      'Time': new Date(t.created_at).toLocaleTimeString('id-ID'),
      'Customer Name': t.customer_name || 'Walk-in',
      'Total Amount (IDR)': t.total,
      'Payment Method': (t.payment_method || '').toUpperCase()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `Sales_Report_${document.getElementById('report-date').value}.xlsx`);
  } catch (err) {
    alert('Failed to export Excel');
  } finally {
    btn.innerHTML = oldHTML;
  }
};

loadReport();
