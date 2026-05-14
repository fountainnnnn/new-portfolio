"use client";

import { useState } from "react";
import { FileImage, FileJson, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardResponse, DashboardSpec } from "@/types/api";

interface ExportPanelProps {
  dashboard: DashboardResponse;
  rows: Record<string, unknown>[] | null;
  /** DOM ids assigned to each Plotly chart so we can call Plotly.toImage on them. */
  chartDomIds: Record<string, string>;
}

/**
 * Spec-driven export utility:
 *  - PNG per chart via Plotly.toImage
 *  - Standalone HTML dashboard with embedded data + Plotly CDN
 *  - JSON DashboardSpec
 */
export function ExportPanel({ dashboard, rows, chartDomIds }: ExportPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const spec = dashboard.spec;

  async function exportPng() {
    if (!spec) return;
    setBusy("png");
    try {
      const Plotly = (await import("plotly.js-dist-min")).default;
      // Naive approach: snap each chart sequentially and pack them into a single tall PNG via canvas.
      const images: { id: string; data: string }[] = [];
      for (const chart of spec.charts) {
        const domId = chartDomIds[chart.chart_id];
        const target = domId ? document.getElementById(domId) : null;
        if (!target) continue;
        try {
          const dataUrl = await Plotly.toImage(target, { format: "png", height: 480, width: 720, scale: 2 });
          images.push({ id: chart.chart_id, data: dataUrl });
        } catch {
          // ignore failed chart
        }
      }
      if (!images.length) {
        triggerDownload(textBlob("No chart could be exported. Open the dashboard tab first."), `${slug(spec.dashboard_title)}.txt`);
        return;
      }
      const composite = await composeImages(images.map((img) => img.data));
      triggerDownload(composite, `${slug(spec.dashboard_title)}.png`);
    } finally {
      setBusy(null);
    }
  }

  function exportJson() {
    if (!spec) return;
    setBusy("json");
    try {
      const payload = JSON.stringify(spec, null, 2);
      triggerDownload(new Blob([payload], { type: "application/json" }), `${slug(spec.dashboard_title)}.json`);
    } finally {
      setBusy(null);
    }
  }

  function exportHtml() {
    if (!spec || !rows) return;
    setBusy("html");
    try {
      const html = buildStandaloneHtml(spec, rows);
      triggerDownload(new Blob([html], { type: "text/html" }), `${slug(spec.dashboard_title)}.html`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={!spec || busy === "png"} onClick={exportPng} size="sm" variant="outline">
        {busy === "png" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <FileImage className="mr-1.5 size-4" />}
        PNG
      </Button>
      <Button disabled={!spec || !rows || busy === "html"} onClick={exportHtml} size="sm" variant="outline">
        {busy === "html" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <FileText className="mr-1.5 size-4" />}
        HTML
      </Button>
      <Button disabled={!spec || busy === "json"} onClick={exportJson} size="sm" variant="outline">
        {busy === "json" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <FileJson className="mr-1.5 size-4" />}
        Spec JSON
      </Button>
    </div>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "dashboard";
}

function textBlob(message: string): Blob {
  return new Blob([message], { type: "text/plain" });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function composeImages(dataUrls: string[]): Promise<Blob> {
  const images = await Promise.all(
    dataUrls.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        }),
    ),
  );
  if (!images.length) return textBlob("No images");
  const width = Math.max(...images.map((img) => img.width));
  const totalHeight = images.reduce((acc, img) => acc + img.height + 24, 24);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return textBlob("Canvas unavailable");
  ctx.fillStyle = "#f4f6fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = 24;
  for (const img of images) {
    ctx.drawImage(img, 0, y, img.width, img.height);
    y += img.height + 24;
  }
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? textBlob("Failed to encode PNG")), "image/png");
  });
}

function buildStandaloneHtml(spec: DashboardSpec, rows: Record<string, unknown>[]): string {
  // Embed the spec + rows into an HTML file that uses the Plotly CDN to render
  // each chart deterministically using the same builder logic as the app.
  const data = JSON.stringify({ spec, rows }).replace(/</g, "\\u003c");
  const cssBackground = spec.theme?.background ?? "#f4f6fb";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(spec.dashboard_title)}</title>
<meta name="viewport" content="width=1280" />
<style>
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: ${cssBackground}; color: #141414; }
  .dashboard { max-width: 1280px; margin: 32px auto; padding: 0 24px; }
  header h1 { font-size: 22px; margin: 0 0 4px; }
  header p { margin: 0 0 24px; color: #667085; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; }
  .card { background: #fff; border: 1px solid #dde4ef; border-radius: 14px; padding: 12px; box-shadow: 0 6px 12px rgba(15,23,42,0.04); }
  .card h3 { margin: 0 0 4px; font-size: 13px; }
  .chart { width: 100%; height: 320px; }
</style>
</head>
<body>
  <div class="dashboard">
    <header>
      <h1>${escapeHtml(spec.dashboard_title)}</h1>
      <p>${escapeHtml(spec.description ?? "")}</p>
    </header>
    <div class="grid" id="grid"></div>
  </div>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
  <script>
    const PAYLOAD = ${data};
    ${INLINE_RENDERER}
    renderDashboard(PAYLOAD);
  </script>
</body>
</html>`;
}

// A trimmed subset of the runtime renderer + query engine, embedded into the
// exported HTML so it is fully standalone. Keep this in sync with the canonical
// builders in lib/plotly + lib/data when adding chart types.
const INLINE_RENDERER = `
function escapeHtml(value){return String(value??'').replace(/[&<>]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function compareValues(a,b){if(a==null && b==null)return 0;if(a==null)return 1;if(b==null)return -1;var na=Number(a),nb=Number(b);if(isFinite(na)&&isFinite(nb))return na-nb;return String(a).localeCompare(String(b));}
function toNumber(v){if(typeof v==='number')return v;if(typeof v==='string'){var n=Number(v.replace(/[, ]+/g,''));return isFinite(n)?n:0;}if(typeof v==='boolean')return v?1:0;return 0;}
function aggregate(rows,xKey,yKey,groupKey,aggregation){var groups=new Map();rows.forEach(function(row){var x=row[xKey];var g=groupKey?row[groupKey]:null;var key=String(x)+'::'+String(g);var n=toNumber(row[yKey]);var b=groups.get(key);if(!b){b={x:x,group:g,values:[],count:0};groups.set(key,b);}if(isFinite(n))b.values.push(n);b.count+=1;});var out=[];groups.forEach(function(b){var v;switch(aggregation){case 'sum':v=b.values.reduce(function(a,c){return a+c;},0);break;case 'avg':case 'mean':v=b.values.length?b.values.reduce(function(a,c){return a+c;},0)/b.values.length:0;break;case 'min':v=b.values.length?Math.min.apply(null,b.values):0;break;case 'max':v=b.values.length?Math.max.apply(null,b.values):0;break;case 'count':v=b.count;break;default:v=b.values.reduce(function(a,c){return a+c;},0);}var r={};r[xKey]=b.x;r[yKey]=v;if(groupKey)r[groupKey]=b.group;out.push(r);});return out;}
function runQuery(rows,q){if(!q)return rows;var out=rows;if(q.aggregation && q.aggregation!=='none' && q.x && q.y){out=aggregate(out,q.x,q.y,q.group_by||null,q.aggregation);}if(q.sort && q.sort!=='none' && (q.y||q.x)){var key=q.y||q.x;var dir=q.sort==='asc'?1:-1;out=out.slice().sort(function(a,b){return compareValues(a[key],b[key])*dir;});}if(q.limit){out=out.slice(0,q.limit);}return out;}
function buildChart(spec,rows){var d=spec.data_query||{};var x=d.x,y=d.y;var rs=runQuery(rows,d);if(spec.chart_type==='bar'||spec.chart_type==='stacked_bar'){return {data:[{type:'bar',x:rs.map(function(r){return r[x];}),y:rs.map(function(r){return r[y];}),marker:{color:(spec.style&&spec.style.color_override)||'#275efe'}}],layout:{barmode:spec.chart_type==='stacked_bar'?'stack':'group',margin:{l:48,r:24,t:8,b:48}}};}if(spec.chart_type==='line'||spec.chart_type==='area'){return {data:[{type:'scatter',mode:'lines+markers',x:rs.map(function(r){return r[x];}),y:rs.map(function(r){return r[y];}),fill:spec.chart_type==='area'?'tozeroy':undefined,line:{color:(spec.style&&spec.style.color_override)||'#275efe',width:2.4},marker:{size:6}}],layout:{margin:{l:48,r:24,t:8,b:48}}};}if(spec.chart_type==='scatter'){return {data:[{type:'scatter',mode:'markers',x:rows.map(function(r){return r[x];}),y:rows.map(function(r){return r[y];}),marker:{color:(spec.style&&spec.style.color_override)||'#275efe',size:8,opacity:0.78}}],layout:{margin:{l:48,r:24,t:8,b:48}}};}if(spec.chart_type==='histogram'){return {data:[{type:'histogram',x:rows.map(function(r){return r[x||y];}),marker:{color:(spec.style&&spec.style.color_override)||'#275efe'}}],layout:{margin:{l:48,r:24,t:8,b:48}}};}if(spec.chart_type==='box'){return {data:[{type:'box',y:rows.map(function(r){return r[y||x];}),x:x&&x!==y?rows.map(function(r){return r[x];}):undefined,boxpoints:'outliers'}],layout:{margin:{l:48,r:24,t:8,b:48}}};}if(spec.chart_type==='pie'){return {data:[{type:'pie',labels:rs.map(function(r){return String(r[x]);}),values:y?rs.map(function(r){return Number(r[y]);}):rs.map(function(){return 1;}),hole:0.42}],layout:{margin:{l:8,r:8,t:8,b:8}}};}if(spec.chart_type==='treemap'){return {data:[{type:'treemap',labels:rs.map(function(r){return String(r[x]);}),parents:rs.map(function(){return '';}),values:y?rs.map(function(r){return Number(r[y]);}):rs.map(function(){return 1;})}],layout:{margin:{l:0,r:0,t:0,b:0}}};}if(spec.chart_type==='kpi'){var sum=rs.reduce(function(a,r){return a+Number(r[y||x]||0);},0);return {data:[{type:'indicator',mode:'number',value:sum,number:{valueformat:',.0f'},title:{text:spec.title}}],layout:{margin:{l:24,r:24,t:24,b:24}}};}if(spec.chart_type==='table'){var keys=Object.keys(rs[0]||{}).slice(0,12);return {data:[{type:'table',header:{values:keys.map(function(k){return '<b>'+k+'</b>';}),align:'left'},cells:{values:keys.map(function(k){return rs.map(function(r){return r[k];});}),align:'left',height:24}}],layout:{margin:{l:0,r:0,t:0,b:0}}};}return {data:[],layout:{margin:{l:0,r:0,t:0,b:0}}};}
function renderDashboard(payload){var grid=document.getElementById('grid');payload.spec.charts.forEach(function(spec){var item=(payload.spec.layout&&payload.spec.layout.items||[]).find(function(i){return i.item_id===spec.chart_id;});var w=item?item.w:6;var h=item?item.h:4;var card=document.createElement('div');card.className='card';card.style.gridColumn='span '+w+' / span '+w;card.style.minHeight=(h*72)+'px';card.innerHTML='<h3>'+escapeHtml(spec.title)+'</h3><div class="chart" id="chart-'+spec.chart_id+'"></div>';grid.appendChild(card);var fig=buildChart(spec,payload.rows);Plotly.newPlot('chart-'+spec.chart_id,fig.data,Object.assign({autosize:true,paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{family:'Inter,system-ui'},xaxis:{title:spec.encoding&&spec.encoding.x_label||spec.data_query.x||''},yaxis:{title:spec.encoding&&spec.encoding.y_label||spec.data_query.y||''},showlegend:!!(spec.style&&spec.style.show_legend!==false)},fig.layout),{displaylogo:false,responsive:true});});}`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
}
