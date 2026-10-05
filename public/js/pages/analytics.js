import { ReportsAPI } from '/js/api.js';
import { formatRupiah, currentMonthISO } from '/js/utils.js';

document.getElementById('analytics-month').value = currentMonthISO();

function formatRupiahCompact(value) {
  if (value >= 1000000) {
    return 'Rp ' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + ' Jt';
  } else if (value >= 1000) {
    return 'Rp ' + (value / 1000).toFixed(0) + ' Rb';
  }
  return 'Rp ' + value;
}

let currentAnalyticsData = null;

async function loadAnalytics() {
  window.loadAnalytics = loadAnalytics;
  const month = document.getElementById('analytics-month').value || currentMonthISO();
  try {
    const data = await ReportsAPI.monthly(month);
    currentAnalyticsData = data;
    const { totalRevenue, totalOrders, avgOrder, revChangePct } = data.summary;

    document.getElementById('a-revenue').textContent = formatRupiah(totalRevenue);
    document.getElementById('a-orders').textContent  = totalOrders;
    document.getElementById('a-avg').textContent     = formatRupiah(avgOrder);

    const pct = revChangePct || 0;
    document.getElementById('a-rev-pct').textContent = `${pct >= 0 ? '+' : ''}${pct}% vs last month`;
    document.getElementById('a-rev-icon').textContent = pct >= 0 ? 'trending_up' : 'trending_down';
    document.getElementById('a-rev-icon').style.color = pct >= 0 ? '#4ade80' : '#f87171';

    // === Daily chart (Enhanced) ==================================
    const maxRev = Math.max(...data.daily.map(d=>d.revenue), 1);
    
    // Find peak day (highest revenue)
    let peakDay = null;
    let peakRev = -1;
    let peakOrders = 0;
    
    // Find quietest day (lowest positive revenue, or 0 if all 0)
    let quietDay = null;
    let quietRev = Infinity;
    let quietOrders = 0;
    
    data.daily.forEach(d => {
      if (d.revenue > peakRev) {
        peakRev = d.revenue;
        peakDay = d.day;
        peakOrders = d.orders || 0;
      }
      if (d.revenue > 0 && d.revenue < quietRev) {
        quietRev = d.revenue;
        quietDay = d.day;
        quietOrders = d.orders || 0;
      }
    });
    
    if (quietRev === Infinity) {
      quietRev = 0;
      quietDay = '-';
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

    document.getElementById('last-day').textContent = data.daily.length;
    
    // Render Bars
    const chartContainer = document.getElementById('daily-chart');
    chartContainer.innerHTML = data.daily.map(d => {
      const pct = Math.max(2, (d.revenue / maxRev) * 100);
      const dateString = `${month}-${String(d.day).padStart(2,'0')}`;
      const dateObj = new Date(dateString);
      const isWeekend = dateObj.getDay() % 6 === 0;
      const isActive = d.revenue > 0;
      const isPeak = d.day === peakDay && isActive;
      
      let barClass = 'chart-bar chart-bar-empty';
      let styleString = `height:${pct}%;`;
      
      if (isActive) {
        if (isPeak) {
          barClass = 'chart-bar chart-bar-peak';
        } else if (isWeekend) {
          barClass = 'chart-bar chart-bar-weekend';
        } else {
          barClass = 'chart-bar chart-bar-active';
        }
      }
      
      return `<div 
        class="${barClass}" 
        style="${styleString}"
        data-day="${d.day}"
        data-revenue="${d.revenue}"
        data-orders="${d.orders || 0}"
        data-date="${dateString}"
      ></div>`;
    }).join('');

    // Setup interactive tooltip
    const tooltip = document.getElementById('chart-tooltip');
    const bars = chartContainer.querySelectorAll('.chart-bar');
    
    bars.forEach(bar => {
      bar.addEventListener('pointermove', (e) => {
        const day = bar.getAttribute('data-day');
        const revenue = parseFloat(bar.getAttribute('data-revenue'));
        const orders = bar.getAttribute('data-orders');
        const rawDate = bar.getAttribute('data-date');
        
        // Format Indonesian Date
        const dateObj = new Date(rawDate);
        const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        
        tooltip.innerHTML = `
          <div class="chart-tooltip-date">${dayName}</div>
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

    // Populate Dynamic Insights Cards
    const insightsEl = document.getElementById('daily-insights');
    if (insightsEl) {
      insightsEl.innerHTML = `
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(16, 185, 129, 0.15); color:#10b981;">
            <span class="material-symbols-outlined">trending_up</span>
          </div>
          <div class="insight-info">
            <span class="insight-label">Hari Puncak (Peak)</span>
            <span class="insight-val text-rupiah">${formatRupiah(peakRev)}</span>
            <span class="insight-subtext">Tanggal ${peakDay} (${peakOrders} Transaksi)</span>
          </div>
        </div>
        <div class="insight-item">
          <div class="insight-icon" style="background:rgba(96, 165, 250, 0.15); color:#60a5fa;">
            <span class="material-symbols-outlined">hotel</span>
          </div>
          <div class="insight-info">
            <span class="insight-label">Hari Tersepi (Quiet)</span>
            <span class="insight-val text-rupiah">${quietRev > 0 ? formatRupiah(quietRev) : 'Tidak ada omzet'}</span>
            <span class="insight-subtext">Tanggal ${quietDay} ${quietRev > 0 ? `(${quietOrders} Transaksi)` : ''}</span>
          </div>
        </div>
      `;
    }

    // Top products
    const topDiv = document.getElementById('a-top-products');
    if (!data.topProducts.length) {
      topDiv.innerHTML = `<p style="color:var(--outline);font-size:0.875rem;">No sales data this month</p>`;
    } else {
      const maxRev2 = data.topProducts[0].revenue;
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
      topDiv.innerHTML = data.topProducts.map((p,i) => `
        <div style="display:flex;align-items:center;gap:0.875rem;">
          <span style="font-size:1.25rem;">${medals[i]||i+1}</span>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:0.25rem;">
              <span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:12rem;">${p.name}</span>
              <span style="font-weight:700;" class="text-rupiah">${formatRupiah(p.revenue)}</span>
            </div>
            <div style="height:0.375rem;background:var(--surface-container-high);border-radius:9999px;overflow:hidden;">
              <div style="height:100%;width:${Math.round(p.revenue/maxRev2*100)}%;background:${i===0?'#22c55e':i===1?'#3b82f6':i===2?'#f59e0b':'var(--primary-container)'};border-radius:9999px;"></div>
            </div>
            <span style="font-size:0.6875rem;color:var(--on-surface-variant);">${p.qty} units sold</span>
          </div>
        </div>`).join('');
    }
  } catch (err) {
    document.getElementById('a-revenue').textContent = 'Error';
    document.getElementById('a-top-products').innerHTML = `<p style="color:var(--error);">${err.message}</p>`;
  }
}

window.exportAnalyticsExcel = async function() {
  if (!currentAnalyticsData) return alert('No data to export');
  
  const btn = document.getElementById('btn-export-analytics');
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

    const wb = XLSX.utils.book_new();

    // Sheet 1: Daily Breakdown
    const dailyData = currentAnalyticsData.daily.map(d => ({
      'Date': `${document.getElementById('analytics-month').value}-${String(d.day).padStart(2,'0')}`,
      'Revenue (IDR)': d.revenue,
      'Orders': d.orders
    }));
    const wsDaily = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Revenue");

    // Sheet 2: Top Products
    const productData = currentAnalyticsData.topProducts.map(p => ({
      'Product Name': p.name,
      'Quantity Sold': p.qty,
      'Revenue Generated (IDR)': p.revenue
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productData);
    XLSX.utils.book_append_sheet(wb, wsProducts, "Top Products");

    XLSX.writeFile(wb, `Analytics_${document.getElementById('analytics-month').value}.xlsx`);
  } catch (err) {
    alert('Failed to export Excel');
  } finally {
    btn.innerHTML = oldHTML;
  }
};

loadAnalytics();
