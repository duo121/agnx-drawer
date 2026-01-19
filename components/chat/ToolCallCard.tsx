"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Download,
  MousePointerClick,
  XCircle,
} from "lucide-react";
import type {Dispatch, SetStateAction} from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {encodePlantUML} from "@/shared/script-convertor";
import {CodeBlock} from "@/components/code-block";
import {isMxCellXmlComplete} from "@/shared/utils";
import type {DiagramOperation, ToolPartLike} from "./types";
import type {ExcalidrawOperation} from "@/hooks/engines";

interface ToolCallCardProps {
  part: ToolPartLike;
  expandedTools: Record<string, boolean>;
  setExpandedTools: Dispatch<SetStateAction<Record<string, boolean>>>;
  onCopy: (callId: string, text: string, isToolCall: boolean) => void;
  onReinsert?: (payload: {
    xml?: string;
    code?: string;
    toolName: string;
    excalidrawScene?: {elements: any[]; appState?: any; files?: Record<string, any>};
    operations?: DiagramOperation[];
    excalidrawOperations?: ExcalidrawOperation[];
  }) => void;
  copiedToolCallId: string | null;
  copyFailedToolCallId: string | null;
  dict: {
    tools: {complete: string};
    chat: {copied: string; failedToCopy: string; copyResponse: string};
  };
}

function OperationsDisplay({operations}: {operations: DiagramOperation[]}) {
  return (
    <div className="space-y-3">
      {operations.map((op, index) => (
        <div
          key={`${op.operation}-${op.cell_id}-${index}`}
          className="rounded-lg border border-border/50 overflow-hidden bg-background/50"
        >
          <div className="px-3 py-1.5 bg-muted/40 border-b border-border/30 flex items-center gap-2">
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${
                op.operation === "delete" ? "text-red-600" : op.operation === "add" ? "text-green-600" : "text-blue-600"
              }`}
            >
              {op.operation}
            </span>
            <span className="text-xs text-muted-foreground">cell_id: {op.cell_id}</span>
          </div>
          {op.new_xml && (
            <div className="px-3 py-2">
              <pre className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                {op.new_xml}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ToolCallCard({
  part,
  expandedTools,
  setExpandedTools,
  onCopy,
  onReinsert,
  copiedToolCallId,
  copyFailedToolCallId,
  dict,
}: ToolCallCardProps) {
  const callId = part.toolCallId;
  const {state, input, output, result} = part;
  // Default to collapsed if tool is complete, expanded if still streaming
  const isExpanded = expandedTools[callId] ?? state !== "output-available";
  const toolName = part.type?.replace("tool-", "");
  const isCopied = copiedToolCallId === callId;
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const downloadButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  useEffect(() => {
    if (!showDownloadMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node) &&
          downloadButtonRef.current && !downloadButtonRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDownloadMenu]);
  
  useEffect(() => {
    if (showDownloadMenu && downloadButtonRef.current) {
      const rect = downloadButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.right,
      });
    }
  }, [showDownloadMenu]);

  const meta = useMemo(() => {
    const base: any = {};
    
    // Try to extract from result (server-side tool execution)
    const merged = typeof result === "object" && result ? {...base, ...(result as any)} : base;
    
    // Try to extract from output (client-side tool callback)
    if (output && typeof output === "object") {
      Object.assign(merged, output as any);
    }
    
    // Try to extract from part itself (some AI SDKs put result at top level)
    const partAny = part as any;
    if (partAny.result && typeof partAny.result === "object") {
      Object.assign(merged, partAny.result);
    }
    if (partAny.args && typeof partAny.args === "object") {
      Object.assign(merged, partAny.args);
    }
    
    // Fallbacks from input
    if (input && typeof input === "object") {
      const i = input as any;
      if (!merged.code && i.code) merged.code = i.code;
      if (!merged.xml && i.xml) merged.xml = i.xml;
      if (!merged.pngUrl && i.pngUrl) merged.pngUrl = i.pngUrl;
      if (!merged.svgUrl && i.svgUrl) merged.svgUrl = i.svgUrl;
      if (!merged.elements && i.elements) merged.elements = i.elements;
      if (!merged.files && i.files) merged.files = i.files;
    }
    
    // Debug for Mermaid
    if (toolName === "convert_mermaid_to_excalidraw") {
      console.log("[ToolCallCard] meta construction:", {
        part,
        output,
        result, 
        input,
        partResult: partAny.result,
        partArgs: partAny.args,
        merged,
      });
    }
    
    return merged;
  }, [part, output, result, input, toolName]);

  const toggleExpanded = () => {
    setExpandedTools((prev) => ({
      ...prev,
      [callId]: !isExpanded,
    }));
  };

  const getToolDisplayName = (name: string) => {
    switch (name) {
      case "display_drawio":
        return "Generate Diagram";
      case "edit_drawio":
        return "Edit Diagram";
      case "read_file":
        return "Read File";
      case "switch_canvas":
        return "Switch Canvas";
      case "convert_plantuml_to_drawio":
        return "PlantUML → Draw.io";
      case "convert_mermaid_to_excalidraw":
        return "Mermaid → Excalidraw";
      case "display_excalidraw":
        return "Generate Diagram (Excalidraw)";
      case "append_excalidraw":
        return "Append Diagram (Excalidraw)";
      case "edit_excalidraw":
        return "Edit Diagram (Excalidraw)";
      default:
        return name;
    }
  };

  const textToCopy = useMemo(() => {
    const inputObj = (input || {}) as any;
    const merged = meta as any;

    // For Mermaid and PlantUML, prioritize code
    if (toolName === "convert_mermaid_to_excalidraw" || toolName === "convert_plantuml_to_drawio") {
      if (typeof merged?.code === "string" && merged.code.trim()) return merged.code;
      if (typeof inputObj?.code === "string" && inputObj.code.trim()) return inputObj.code;
    }

    // For Excalidraw tools, prioritize full payload (elements/appState/files)
    if (toolName?.includes("excalidraw") && toolName !== "convert_mermaid_to_excalidraw" && input && typeof input === "object" && Object.keys(input).length > 0) {
      return JSON.stringify(input, null, 2);
    }

    if (typeof merged?.code === "string" && merged.code.trim()) return merged.code;
    if (typeof merged?.xml === "string" && merged.xml.trim()) return merged.xml;
    if (typeof inputObj?.code === "string" && inputObj.code.trim()) return inputObj.code;
    if (typeof inputObj?.xml === "string" && inputObj.xml.trim()) return inputObj.xml;

    // Prefer structured output/result if available
    if (output && typeof output === "object") return JSON.stringify(output, null, 2);
    if (result && typeof result === "object") return JSON.stringify(result, null, 2);

    if (typeof result === "string" && result.trim()) return result;
    if (typeof output === "string" && output.trim()) return output;
    if (input && typeof input === "object" && Object.keys(input).length > 0) {
      return JSON.stringify(input, null, 2);
    }
    return "";
  }, [meta, input, result, output, toolName]);

  const hasCopyableContent = textToCopy.trim().length > 0;

  const excalidrawScene = useMemo(() => {
    if (!toolName?.includes("excalidraw")) {
      return undefined;
    }

    // 优先级：result > output > meta > input
    // 服务端 execute 返回的数据在 result 中
    const candidates = [
      typeof result === "object" ? (result as any) : null,
      typeof output === "object" ? (output as any) : null,
      typeof meta === "object" ? (meta as any) : null,
      (meta as any)?.scene,
      (meta as any)?.data,
      typeof input === "object" ? (input as any) : null,
    ].filter(Boolean);
    
    // Debug logging for Mermaid
    if (toolName === "convert_mermaid_to_excalidraw") {
      console.log("[ToolCallCard] Mermaid excalidrawScene extraction:", {
        resultElementsCount: (result as any)?.elements?.length || 0,
        outputElementsCount: (output as any)?.elements?.length || 0,
        metaElementsCount: (meta as any)?.elements?.length || 0,
        inputElementsCount: (input as any)?.elements?.length || 0,
        candidatesWithElements: candidates.filter(c => Array.isArray(c?.elements) && c.elements.length > 0).length,
        totalCandidates: candidates.length,
      });
    }
    
    for (const candidate of candidates) {
      if (candidate && Array.isArray(candidate.elements) && candidate.elements.length > 0) {
        return {
          elements: candidate.elements,
          appState: candidate.appState,
          files: candidate.files,
        };
      }
    }
    return undefined;
  }, [toolName, result, output, meta, input]);

  const handleCopy = () => {
    if (hasCopyableContent) {
      onCopy(callId, textToCopy, true);
    } else {
      console.warn("[ToolCallCard] No code to copy", {meta, input});
    }
  };

  return (
    <div className="my-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground/80">{getToolDisplayName(toolName)}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons (visible even when collapsed) */}
          {hasCopyableContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={
                copiedToolCallId === callId
                  ? dict.chat.copied
                  : copyFailedToolCallId === callId
                    ? dict.chat.failedToCopy
                    : dict.chat.copyResponse
              }
            >
              {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          )}
          {toolName === "convert_plantuml_to_drawio" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onReinsert?.({
                    xml: (meta?.xml as string) || (input as any)?.xml,
                    code: (meta?.code as string) || (input as any)?.code,
                    toolName,
                  }) || console.warn("[ToolCallCard] Reinsert clicked without xml", {meta, input})
                }
                className="p-1 rounded hover:bg-muted transition-colors"
                title="重新插入并选中"
              >
                <MousePointerClick className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="relative">
                <button
                  ref={downloadButtonRef}
                  type="button"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="下载"
                  onClick={() => setShowDownloadMenu((prev) => !prev)}
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
                {showDownloadMenu && typeof window !== "undefined" && createPortal(
                  <div
                    ref={downloadMenuRef}
                    className="fixed inline-flex min-w-max flex-col rounded-md border border-border bg-background shadow-lg z-9999"
                    style={{
                      top: `${menuPosition.top}px`,
                      left: `${menuPosition.left}px`,
                      transform: 'translateX(-100%)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (meta?.pngUrl) {
                          window.open(meta.pngUrl as string, "_blank");
                        } else if (meta?.code) {
                          const url = await encodePlantUML(meta.code as string, {format: "png"});
                          window.open(url, "_blank");
                        } else {
                          console.warn("[ToolCallCard] No PNG URL", meta);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
                    >
                      下载 PNG
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (meta?.svgUrl) {
                          window.open(meta.svgUrl as string, "_blank");
                        } else if (meta?.code) {
                          const url = await encodePlantUML(meta.code as string, {format: "svg"});
                          window.open(url, "_blank");
                        } else {
                          console.warn("[ToolCallCard] No SVG URL", meta);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
                    >
                      下载 SVG
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            </>
          )}
          {toolName === "convert_mermaid_to_excalidraw" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onReinsert?.({
                    toolName,
                    excalidrawScene,
                    // 传递 code 以支持重新转换
                    code: (meta?.code as string) || (input as any)?.code,
                  })
                }
                className="p-1 rounded hover:bg-muted transition-colors"
                title="重新插入并选中"
              >
                <MousePointerClick className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="relative">
                <button
                  ref={downloadButtonRef}
                  type="button"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="下载"
                  onClick={() => setShowDownloadMenu((prev) => !prev)}
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
                {showDownloadMenu && typeof window !== "undefined" && createPortal(
                  <div
                    ref={downloadMenuRef}
                    className="fixed inline-flex min-w-max flex-col rounded-md border border-border bg-background shadow-lg z-9999"
                    style={{
                      top: `${menuPosition.top}px`,
                      left: `${menuPosition.left}px`,
                      transform: 'translateX(-100%)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (meta?.pngUrl) {
                          window.open(meta.pngUrl as string, "_blank");
                        } else if (meta?.code) {
                          // Fallback: 用 code 生成 URL
                          const { buildMermaidImgUrl } = await import("@/shared/script-convertor");
                          const url = await buildMermaidImgUrl(meta.code as string, {format: "png"});
                          window.open(url, "_blank");
                        } else {
                          console.warn("[ToolCallCard] No PNG URL for Mermaid", meta);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
                    >
                      下载 PNG
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (meta?.svgUrl) {
                          window.open(meta.svgUrl as string, "_blank");
                        } else if (meta?.code) {
                          // Fallback: 用 code 生成 URL
                          const { buildMermaidImgUrl } = await import("@/shared/script-convertor");
                          const url = await buildMermaidImgUrl(meta.code as string, {format: "svg"});
                          window.open(url, "_blank");
                        } else {
                          console.warn("[ToolCallCard] No SVG URL for Mermaid", meta);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
                    >
                      下载 SVG
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            </>
          )}
          {/* Excalidraw 工具的执行按钮 - 生成类工具 (display_excalidraw, append_excalidraw, convert_mermaid_to_excalidraw) */}
          {toolName?.includes("excalidraw") && toolName !== "edit_excalidraw" && excalidrawScene && (
            <button
              type="button"
              onClick={() =>
                onReinsert?.({
                  toolName,
                  excalidrawScene,
                })
              }
              className="p-1 rounded-full border border-border/60 hover:bg-muted transition-colors"
              title="重新插入并选中"
            >
              <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {/* Excalidraw edit_excalidraw 的执行按钮 */}
          {toolName === "edit_excalidraw" && input?.operations && Array.isArray(input.operations) && (
            <button
              type="button"
              onClick={() =>
                onReinsert?.({
                  toolName,
                  excalidrawOperations: input.operations as unknown as ExcalidrawOperation[],
                })
              }
              className="p-1 rounded-full border border-border/60 hover:bg-muted transition-colors"
              title="重新执行编辑操作"
            >
              <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {/* DrawIO display_drawio 和 edit_drawio 的执行按钮 */}
          {(toolName === "display_drawio" && input?.xml) && (
            <button
              type="button"
              onClick={() =>
                onReinsert?.({
                  xml: input.xml as string,
                  toolName,
                })
              }
              className="p-1 rounded-full border border-border/60 hover:bg-muted transition-colors"
              title="重新插入并选中"
            >
              <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {(toolName === "edit_drawio" && input?.operations && Array.isArray(input.operations)) && (
            <button
              type="button"
              onClick={() =>
                onReinsert?.({
                  xml: input.xml as string,
                  toolName,
                  operations: input.operations as DiagramOperation[],
                })
              }
              className="p-1 rounded-full border border-border/60 hover:bg-muted transition-colors"
              title="重新执行编辑操作"
            >
              <MousePointerClick className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {state === "input-streaming" && (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {state === "output-available" && (
            <span title={dict.tools.complete}>
              <CheckCircle className="w-4 h-4 text-green-600" aria-hidden />
            </span>
          )}
          {state === "output-error" &&
            (() => {
              // Check if this is a truncation (incomplete XML) vs real error
              const isTruncated =
                (toolName === "display_drawio" || toolName === "append_drawio") && !isMxCellXmlComplete(input?.xml);
              if (isTruncated) {
                return (
                  <span title="Truncated">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" aria-hidden />
                  </span>
                );
              }
              return (
                <span title="Error">
                  <XCircle className="w-4 h-4 text-red-600" aria-hidden />
                </span>
              );
            })()}
          {input && Object.keys(input).length > 0 && (
            <button type="button" onClick={toggleExpanded} className="p-1 rounded hover:bg-muted transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
      {input && isExpanded && (
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
          {typeof input === "object" && input.xml ? (
            <CodeBlock code={input.xml} language="xml" />
          ) : typeof input === "object" && input.operations && Array.isArray(input.operations) ? (
            <OperationsDisplay operations={input.operations} />
          ) : typeof input === "object" && Object.keys(input).length > 0 ? (
            <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
          ) : null}
        </div>
      )}
      {state === "output-error" && isExpanded &&
        (() => {
          const isTruncated =
            (toolName === "display_drawio" || toolName === "append_drawio") && !isMxCellXmlComplete(input?.xml);
          const errorText =
            typeof output === "string" ? output : typeof output === "object" ? JSON.stringify(output, null, 2) : "";
          return (
            <div
              className={`px-4 py-3 border-t border-border/40 text-sm ${isTruncated ? "text-yellow-600" : "text-red-600"}`}
            >
              {isTruncated
                ? "Output truncated due to length limits. Try a simpler request or increase the maxOutputLength."
                : errorText}
            </div>
          );
        })()}
      {/* Show read_file output on success */}
      {toolName === "read_file" && state === "output-available" && isExpanded && (
        <div className="px-4 py-3 border-t border-border/40">
          {(() => {
            const fileResult = output as { success?: boolean; path?: string; content?: string; lineCount?: number; error?: string } | null;
            if (fileResult?.success) {
              return (
                <>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-600" />
                    <span>{fileResult.path}</span>
                    <span className="text-muted-foreground/60">({fileResult.lineCount} lines)</span>
                  </div>
                  <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                    {fileResult.content?.substring(0, 1500)}
                    {(fileResult.content?.length || 0) > 1500 && "\n..."}
                  </pre>
                </>
              );
            }
            return (
              <div className="text-xs text-red-600 flex items-center gap-2">
                <XCircle className="w-3 h-3" />
                <span>{fileResult?.error || "Failed to read file"}</span>
              </div>
            );
          })()}
        </div>
      )}
      {/* Show switch_canvas output */}
      {toolName === "switch_canvas" && state === "output-available" && isExpanded && (
        <div className="px-4 py-3 border-t border-border/40">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Check className="w-3 h-3 text-green-600" />
            <span>Switching to {(input as { target?: string })?.target || "unknown"} canvas</span>
          </div>
          {(input as { reason?: string })?.reason && (
            <div className="text-xs text-muted-foreground/70 mt-1 ml-5">
              {(input as { reason?: string }).reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
