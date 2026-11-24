/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Table as TableIcon,
  FileText,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  List,
  Bold,
  Info,
} from "lucide-react";

// Standard DS AQUA Proposal Template pre-configured from the 9-page Technical & Commercial Offer
export const STANDARD_DS_AQUA_PROPOSAL_SECTIONS = [
  {
    id: 1,
    title: "2. PROJECT SCOPE & DESIGN BASIS",
    description:
      "Proposed system: a nominal 1,000 LPH reverse osmosis plant + UV + ATM, intended to reduce dissolved salts and selected impurities in feed water. Final sizing and configuration must be confirmed after a representative raw-water test.",
    blocks: [
      {
        id: 101,
        type: "table",
        title: "Included scope (proposed)",
        headers: ["Item", "Description"],
        rows: [
          ["1", "Engineering and supply of one 1000 LPH RO + UV + ATM system to the mutually approved design."],
          ["2", "Feed-water pre-treatment arrangement, as indicated by the water-test results and final process design."],
          ["3", "RO high-pressure pump, membrane pressure housing(s), membrane element(s) and associated pipework."],
          ["4", "UV disinfection unit on the treated-water line, selected for design flow."],
          ["5", "Water ATM Dispensing Unit – Coin + Card + QR-based automated dispenser with flow control."],
          ["6", "2 Ton Water Chiller for chilled water output (8–12°C)."],
          ["7", "1000 Liter SS 304 Storage Tank with level sensors and auto-fill."],
          ["8", "Basic control panel, pressure gauges and operating instruments listed in the approved BOQ."],
          ["9", "Standard installation, connections within the agreed boundary, start-up and operator handover."],
          ["10", "Basic operation and maintenance orientation for the nominated operator."],
        ],
      },
      {
        id: 102,
        type: "bold",
        content:
          "The 1,000 LPH Reverse Osmosis Plant reduces the raw water TDS from approximately 500–2,000 PPM to 50–100 PPM, ensuring purified water suitable for drinking applications.",
      },
      {
        id: 103,
        type: "table",
        title: "Design assumptions to be confirmed",
        headers: ["Parameter", "Design basis / note"],
        rows: [
          ["Rated capacity", "Nominal 1,000 LPH permeate output; actual output depends on feed temperature, TDS, pressure, recovery and membrane condition."],
          ["Feed water", "Source (borewell / municipal / other) to be declared; laboratory analysis required before finalization."],
          ["Water ATM Dispensing Unit", "Coin validator + RFID card reader + UPI/QR, auto shut-off on low tank level."],
          ["Power supply", "Suitable electrical supply, earthing and protection to be provided at installation point."],
          ["Utilities", "Feed supply, reject drain, treated-water storage tank and suitable floor space by client unless listed in final BOQ."],
          ["Intended use", "For food / beverage use, client to verify applicable food-safety and water-quality requirements through testing."],
        ],
      },
      {
        id: 104,
        type: "note",
        content:
          "RO permeate quality and recovery cannot be guaranteed independently of feed-water analysis and operating conditions. This offer is subject to technical validation before order acceptance.",
      },
    ],
  },
  {
    id: 2,
    title: "3. PROCESS FLOW & MAJOR COMPONENTS",
    description:
      "The RO reject stream must be routed to an approved drain or reuse arrangement. Final pre-treatment is selected after assessing hardness, iron, turbidity, SDI, TDS and other relevant parameters.",
    blocks: [
      {
        id: 201,
        type: "bold",
        content:
          "Raw Water Source → Raw Water Feed Pump → Pre-Treatment → Antiscalant Dosing → Cartridge Filtration → High-Pressure Pump → RO Membrane Assembly → TDS & pH Monitoring → UV Disinfection → 1000 L SS 304 Storage Tank → 2 Ton Water Chiller (8–12°C) → Water ATM Dispensing Unit.",
      },
      {
        id: 202,
        type: "table",
        title: "Indicative component schedule",
        headers: ["Component", "Purpose", "Specification status"],
        rows: [
          ["Cartridge filter housing", "Protect RO membranes from fine particulate matter.", "Micron rating and cartridge count to be finalized."],
          ["High-pressure pump", "Provides pressure required for membrane separation.", "Selected for feed TDS, temperature and recovery."],
          ["RO membrane assembly", "Reduces dissolved salts and many dissolved contaminants.", "Brand, model and quantity in final approved BOQ."],
          ["UV disinfection unit", "Provides a disinfection barrier when correctly sized and maintained.", "UV rating matched to flow and water quality."],
          ["Control panel / instruments", "Supports system operation and monitoring.", "Controls and interlocks as per approved scope."],
          ["Piping and valves", "Connects stages and enables isolation / servicing.", "Material and boundary per final layout."],
        ],
      },
      {
        id: 203,
        type: "bullets",
        title: "Design and safety notes",
        bullets: [
          "RO feed must be free of incompatible oxidants and excessive suspended solids; pre-treatment is essential where indicated by test results.",
          "UV performance depends on water clarity, UV transmittance, lamp condition, sleeve cleanliness and flow rate. UV does not replace storage-tank hygiene.",
          "Storage tank, distribution pump, downstream plumbing and civil/electrical modifications are excluded unless specifically included in writing.",
          "Exact makes, models, quantities and wetted-material grades shall be recorded in the final BOQ before manufacture.",
        ],
      },
    ],
  },
  {
    id: 3,
    title: "4. PERFORMANCE, INSTALLATION & COMMISSIONING",
    description: "",
    blocks: [
      {
        id: 301,
        type: "table",
        title: "Performance expectations",
        headers: ["Parameter", "Offer basis"],
        rows: [
          ["Rated permeate output", "Nominal 1,000 litres/hour at agreed design conditions; not independent of feed-water quality or temperature."],
          ["Salt rejection", "To be established from selected membrane manufacturer's data and agreed feed-water conditions."],
          ["Recovery ratio", "Set after feed-water analysis; excessive recovery can cause scaling or membrane damage."],
          ["UV treatment", "UV unit sized for design flow, subject to water clarity and manufacturer's operating criteria."],
          ["Water-quality acceptance", "Verify through laboratory testing against the intended application and applicable standards."],
        ],
      },
      {
        id: 302,
        type: "bullets",
        title: "Installation and commissioning sequence",
        bullets: [
          "1. Site readiness — Confirm floor space, access, drainage, raw-water source, storage tank, electrical point and safe equipment positioning.",
          "2. Pre-installation review — Review water-analysis report and approve final component schedule and piping layout.",
          "3. Equipment placement — Position the plant and connect feed, reject and permeate lines within the agreed boundary.",
          "4. Flushing and start-up — Flush the system, check for leaks, verify instruments and follow component manufacturers' instructions.",
          "5. Trial run — Record operating pressures, flow readings, conductivity/TDS readings and agreed commissioning parameters.",
          "6. Handover — Provide operating instructions, routine maintenance guidance and a commissioning checklist.",
        ],
      },
      {
        id: 303,
        type: "note",
        content:
          "Customer readiness checklist: ■ Raw-water test report available ■ Feed-water connection ready ■ Drain point ready ■ Treated-water tank ready ■ Electrical supply and earthing ready ■ Access area clear ■ Site representative available for trial run.",
      },
    ],
  },
  {
    id: 4,
    title: "7. OPERATION, MAINTENANCE & RESPONSIBILITIES",
    description: "",
    blocks: [
      {
        id: 401,
        type: "table",
        title: "Responsibility matrix",
        headers: ["Supplier – D S WATER TECH", "Customer – Client"],
        rows: [
          ["Supply equipment in accordance with final approved BOQ.", "Provide accurate PO/billing details and approve specifications before manufacture."],
          ["Carry out agreed standard installation and commissioning.", "Provide safe space, feed water, drainage, power and storage arrangements."],
          ["Provide basic operating instructions and warranty documentation.", "Operate the plant as instructed and maintain operating records."],
          ["Explain warranty coverage and service escalation route.", "Arrange routine consumables and report abnormal operation promptly."],
          ["Confirm any change in price/scope in writing before work proceeds.", "Approve extra work and cost in writing before execution."],
        ],
      },
    ],
  },
];

export default function DynamicSectionBuilder({ sections = [], onChange }) {
  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleCollapse = (secId) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const handleLoadStandardTemplate = () => {
    if (sections && sections.length > 0) {
      if (!window.confirm("Replace current sections with the standard DS Aqua Technical Proposal template?")) {
        return;
      }
    }
    onChange(JSON.parse(JSON.stringify(STANDARD_DS_AQUA_PROPOSAL_SECTIONS)));
  };

  const handleAddSection = () => {
    const nextNumber = sections.length + 2;
    const newSec = {
      id: Date.now(),
      title: `${nextNumber}. NEW PROPOSAL SECTION`,
      description: "",
      blocks: [],
    };
    onChange([...sections, newSec]);
  };

  const handleDeleteSection = (secIndex) => {
    const updated = sections.filter((_, i) => i !== secIndex);
    onChange(updated);
  };

  const handleMoveSection = (secIndex, direction) => {
    const targetIndex = secIndex + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(secIndex, 1);
    updated.splice(targetIndex, 0, moved);
    onChange(updated);
  };

  const handleUpdateSection = (secIndex, field, value) => {
    const updated = [...sections];
    updated[secIndex] = { ...updated[secIndex], [field]: value };
    onChange(updated);
  };

  // Block management
  const handleAddBlock = (secIndex, type) => {
    const updated = [...sections];
    const targetSec = { ...updated[secIndex] };
    const currentBlocks = targetSec.blocks || [];

    let newBlock = { id: Date.now(), type };
    if (type === "table") {
      newBlock = {
        ...newBlock,
        title: "Included Scope / Specifications",
        headers: ["Parameter / Item", "Description / Value"],
        rows: [["1", "Specification details here..."]],
      };
    } else if (type === "bold") {
      newBlock = {
        ...newBlock,
        content: "Important highlight or process flow sequence...",
      };
    } else if (type === "note") {
      newBlock = {
        ...newBlock,
        content: "Please note: Feed-water analysis and site readiness are required before dispatch.",
      };
    } else if (type === "bullets") {
      newBlock = {
        ...newBlock,
        title: "Key Notes & Checklist",
        bullets: ["Point 1...", "Point 2..."],
      };
    }

    targetSec.blocks = [...currentBlocks, newBlock];
    updated[secIndex] = targetSec;
    onChange(updated);
  };

  const handleDeleteBlock = (secIndex, blockIndex) => {
    const updated = [...sections];
    const targetSec = { ...updated[secIndex] };
    targetSec.blocks = targetSec.blocks.filter((_, i) => i !== blockIndex);
    updated[secIndex] = targetSec;
    onChange(updated);
  };

  const handleUpdateBlock = (secIndex, blockIndex, field, value) => {
    const updated = [...sections];
    const targetSec = { ...updated[secIndex] };
    const targetBlock = { ...targetSec.blocks[blockIndex], [field]: value };
    targetSec.blocks[blockIndex] = targetBlock;
    updated[secIndex] = targetSec;
    onChange(updated);
  };

  // Table Column & Row operations
  const handleAddTableColumn = (secIndex, blockIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    const headers = [...(block.headers || [])];
    const newColNum = headers.length + 1;
    headers.push(`Column ${newColNum}`);

    const rows = (block.rows || []).map((r) => [...r, ""]);
    block.headers = headers;
    block.rows = rows;

    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleDeleteTableColumn = (secIndex, blockIndex, colIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    if (block.headers.length <= 1) return;

    block.headers = block.headers.filter((_, i) => i !== colIndex);
    block.rows = (block.rows || []).map((r) => r.filter((_, i) => i !== colIndex));

    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleUpdateTableHeader = (secIndex, blockIndex, colIndex, val) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    const headers = [...block.headers];
    headers[colIndex] = val;
    block.headers = headers;
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleAddTableRow = (secIndex, blockIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    const colCount = block.headers ? block.headers.length : 2;
    const newRow = Array(colCount).fill("");
    block.rows = [...(block.rows || []), newRow];
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleDeleteTableRow = (secIndex, blockIndex, rowIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    block.rows = block.rows.filter((_, i) => i !== rowIndex);
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleUpdateTableCell = (secIndex, blockIndex, rowIndex, colIndex, val) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    const rows = block.rows.map((r, rIdx) => {
      if (rIdx === rowIndex) {
        const rowCopy = [...r];
        rowCopy[colIndex] = val;
        return rowCopy;
      }
      return r;
    });
    block.rows = rows;
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  // Bullet Point operations
  const handleAddBullet = (secIndex, blockIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    block.bullets = [...(block.bullets || []), ""];
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleDeleteBullet = (secIndex, blockIndex, bulletIndex) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    block.bullets = block.bullets.filter((_, i) => i !== bulletIndex);
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  const handleUpdateBullet = (secIndex, blockIndex, bulletIndex, val) => {
    const updated = [...sections];
    const block = { ...updated[secIndex].blocks[blockIndex] };
    const bullets = [...block.bullets];
    bullets[bulletIndex] = val;
    block.bullets = bullets;
    updated[secIndex].blocks[blockIndex] = block;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Dynamic Proposal Scope &amp; Sections Builder</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Add custom main headings, descriptions, dynamic tables, bold highlight boxes, and note callouts.
          </p>
        </div>

        <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleLoadStandardTemplate}
            className="w-full sm:w-auto px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs text-center"
            title="Pre-populate with standard DS Aqua RO Plant technical scope, process flow, and responsibility matrix"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="truncate">Load Standard DS Aqua Template</span>
          </button>
          <button
            type="button"
            onClick={handleAddSection}
            className="w-full sm:w-auto px-3 py-1.5 bg-sky-600 text-white hover:bg-sky-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs shadow-sky-500/10 text-center shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* Sections List */}
      {(!sections || sections.length === 0) ? (
        <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600">No dynamic proposal sections added yet.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click <strong>"Load Standard DS Aqua Template"</strong> to load complete technical specifications, or <strong>"Add Section"</strong> to create a custom heading.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec, sIdx) => {
            const isCollapsed = Boolean(collapsedSections[sec.id]);

            return (
              <div
                key={sec.id || sIdx}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Section Header */}
                <div className="bg-slate-50/80 px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-slate-200/80 gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 mr-1 sm:mr-2">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(sec.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer shrink-0"
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => handleUpdateSection(sIdx, "title", e.target.value)}
                      placeholder="e.g. 2. PROJECT SCOPE & DESIGN BASIS"
                      className="w-full min-w-0 text-xs font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:bg-white px-1.5 py-0.5 rounded focus:outline-hidden transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={sIdx === 0}
                      onClick={() => handleMoveSection(sIdx, -1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={sIdx === sections.length - 1}
                      onClick={() => handleMoveSection(sIdx, 1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sIdx)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer ml-0.5 sm:ml-1"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Section Content */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 space-y-4">
                    {/* Section Description */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">
                        Section Description / Overview Text (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={sec.description || ""}
                        onChange={(e) => handleUpdateSection(sIdx, "description", e.target.value)}
                        placeholder="Introductory text or engineering overview for this section..."
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
                      />
                    </div>

                    {/* Content Blocks inside Section */}
                    {sec.blocks && sec.blocks.length > 0 && (
                      <div className="space-y-3.5 pt-2 border-t border-slate-100">
                        {sec.blocks.map((blk, bIdx) => (
                          <div
                            key={blk.id || bIdx}
                            className="p-3 sm:p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/40 relative space-y-2.5"
                          >
                            {/* Block Header Bar */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                {blk.type === "table" && <TableIcon className="w-3.5 h-3.5 text-sky-600" />}
                                {blk.type === "bold" && <Bold className="w-3.5 h-3.5 text-blue-600" />}
                                {blk.type === "note" && <Info className="w-3.5 h-3.5 text-amber-600" />}
                                {blk.type === "bullets" && <List className="w-3.5 h-3.5 text-emerald-600" />}
                                <span>{blk.type.toUpperCase()} BLOCK</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(sIdx, bIdx)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer text-xs flex items-center gap-1"
                                title="Remove Block"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="text-[10px] font-medium">Remove</span>
                              </button>
                            </div>

                            {/* TYPE: TABLE */}
                            {blk.type === "table" && (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <input
                                    type="text"
                                    value={blk.title || ""}
                                    onChange={(e) => handleUpdateBlock(sIdx, bIdx, "title", e.target.value)}
                                    placeholder="Table Heading (e.g. Included scope (proposed))"
                                    className="flex-1 min-w-0 w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-sky-500"
                                  />
                                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleAddTableColumn(sIdx, bIdx)}
                                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-sky-700 rounded-lg cursor-pointer whitespace-nowrap"
                                    >
                                      + Add Column
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddTableRow(sIdx, bIdx)}
                                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-emerald-700 rounded-lg cursor-pointer whitespace-nowrap"
                                    >
                                      + Add Row
                                    </button>
                                  </div>
                                </div>

                                <div className="overflow-x-auto scrollbar-thin border border-slate-200 rounded-lg bg-white">
                                  <table className="w-full min-w-[500px] text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-sky-700 text-white">
                                        {(blk.headers || []).map((h, cIdx) => (
                                          <th key={cIdx} className="p-2 border-r border-sky-600 last:border-r-0">
                                            <div className="flex items-center justify-between gap-1">
                                              <input
                                                type="text"
                                                value={h}
                                                onChange={(e) =>
                                                  handleUpdateTableHeader(sIdx, bIdx, cIdx, e.target.value)
                                                }
                                                className="bg-transparent text-white font-semibold text-xs border-b border-transparent hover:border-sky-300 focus:border-white focus:outline-hidden w-full"
                                              />
                                              {blk.headers.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteTableColumn(sIdx, bIdx, cIdx)}
                                                  className="text-sky-200 hover:text-white p-0.5 cursor-pointer"
                                                  title="Delete column"
                                                >
                                                  &times;
                                                </button>
                                              )}
                                            </div>
                                          </th>
                                        ))}
                                        <th className="w-8 p-1 text-center"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(blk.rows || []).map((r, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-slate-50/70">
                                          {r.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-1.5 border-r border-slate-100 last:border-r-0">
                                              <input
                                                type="text"
                                                value={cell}
                                                onChange={(e) =>
                                                  handleUpdateTableCell(sIdx, bIdx, rIdx, cIdx, e.target.value)
                                                }
                                                placeholder="..."
                                                className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-sky-500 focus:bg-white rounded focus:outline-hidden bg-transparent"
                                              />
                                            </td>
                                          ))}
                                          <td className="p-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteTableRow(sIdx, bIdx, rIdx)}
                                              className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer"
                                              title="Delete row"
                                            >
                                              &times;
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* TYPE: BOLD / HIGHLIGHT BOX */}
                            {blk.type === "bold" && (
                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-semibold text-sky-800">
                                  Bold Highlight Box / Process Sequence Text
                                </label>
                                <textarea
                                  rows={2}
                                  value={blk.content || ""}
                                  onChange={(e) => handleUpdateBlock(sIdx, bIdx, "content", e.target.value)}
                                  placeholder="e.g. The 1,000 LPH Reverse Osmosis Plant reduces the raw water TDS from approximately 500–2,000 PPM to 50–100 PPM..."
                                  className="w-full text-xs p-2.5 border border-sky-300 rounded-lg bg-sky-50/60 font-semibold text-sky-950 focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                />
                              </div>
                            )}

                            {/* TYPE: NOTE CALLOUT */}
                            {blk.type === "note" && (
                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  Note / Warning / Disclaimer Callout
                                </label>
                                <textarea
                                  rows={2}
                                  value={blk.content || ""}
                                  onChange={(e) => handleUpdateBlock(sIdx, bIdx, "content", e.target.value)}
                                  placeholder="e.g. RO permeate quality and recovery cannot be guaranteed independently of feed-water analysis..."
                                  className="w-full text-xs p-2.5 border border-amber-300 rounded-lg bg-amber-50/60 text-amber-950 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                />
                              </div>
                            )}

                            {/* TYPE: BULLETS / CHECKLIST */}
                            {blk.type === "bullets" && (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <input
                                    type="text"
                                    value={blk.title || ""}
                                    onChange={(e) => handleUpdateBlock(sIdx, bIdx, "title", e.target.value)}
                                    placeholder="Sub-heading (e.g. Design and safety notes / Installation sequence)"
                                    className="flex-1 min-w-0 w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-emerald-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddBullet(sIdx, bIdx)}
                                    className="self-end sm:self-auto px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-emerald-700 rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
                                  >
                                    + Add Point
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {(blk.bullets || []).map((b, bItemIdx) => (
                                    <div key={bItemIdx} className="flex items-center gap-2">
                                      <span className="text-slate-400 text-xs shrink-0">•</span>
                                      <input
                                        type="text"
                                        value={b}
                                        onChange={(e) =>
                                          handleUpdateBullet(sIdx, bIdx, bItemIdx, e.target.value)
                                        }
                                        placeholder="Bullet item text..."
                                        className="flex-1 min-w-0 text-xs px-2.5 py-1 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-emerald-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBullet(sIdx, bIdx, bItemIdx)}
                                        className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Content Block Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">Add to this section:</span>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleAddBlock(sIdx, "table")}
                          className="px-2.5 py-1.5 sm:py-1 bg-white border border-slate-200 hover:border-sky-300 hover:text-sky-700 rounded-lg text-xs font-medium text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <TableIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>+ Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddBlock(sIdx, "bold")}
                          className="px-2.5 py-1.5 sm:py-1 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 rounded-lg text-xs font-medium text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Bold className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>+ Flow Box</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddBlock(sIdx, "note")}
                          className="px-2.5 py-1.5 sm:py-1 bg-white border border-slate-200 hover:border-amber-300 hover:text-amber-700 rounded-lg text-xs font-medium text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>+ Note</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddBlock(sIdx, "bullets")}
                          className="px-2.5 py-1.5 sm:py-1 bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 rounded-lg text-xs font-medium text-slate-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <List className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>+ Bullets</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

