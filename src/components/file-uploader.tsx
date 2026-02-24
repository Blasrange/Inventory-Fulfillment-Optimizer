"use client";
import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  title: string;
  onFileRead: (content: string | ArrayBuffer) => void;
  onFileReset: () => void;
  recordCount?: number | null;
}

export function FileUploader({
  title,
  onFileRead,
  onFileReset,
  recordCount,
}: FileUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    const reader = new FileReader();
    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    reader.onload = (e) => {
      const content = e.target?.result;
      if (content) {
        onFileRead(content);
        setFileName(file.name);
      } else {
        console.error("Failed to read file content");
        handleReset();
      }
    };
    reader.onerror = () => {
      console.error("Failed to read file");
      handleReset();
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    const acceptedTypes = [
      "text/csv",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const acceptedExtensions = [".csv", ".tsv", ".txt", ".xlsx"];
    if (
      file &&
      (acceptedTypes.includes(file.type) ||
        acceptedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext)))
    ) {
      readFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleReset = () => {
    setFileName(null);
    onFileReset();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Esta lógica reinicia el cargador de archivos cuando el padre lo indica (por ejemplo, al cambiar de cliente)
  if (recordCount === null && fileName !== null) {
    handleReset();
  }

  const getFileIcon = (filename: string) => {
    if (filename.toLowerCase().endsWith(".xlsx")) {
      return <FileSpreadsheet className="h-6 w-6 text-green-500" />;
    } else if (filename.toLowerCase().endsWith(".csv")) {
      return <FileText className="h-6 w-6 text-blue-500" />;
    } else {
      return <File className="h-6 w-6 text-amber-500" />;
    }
  };

  return (
    <Card className="w-full rounded-xl border shadow-sm bg-white transition-all duration-300 overflow-hidden hover:shadow-md">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50/50 p-4">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
              <UploadCloud className="h-4 w-4 text-primary" />
            </div>
            <span>{title}</span>
          </div>
          {recordCount !== null && recordCount !== undefined && fileName && (
            <Badge
              variant="secondary"
              className="text-[10px] px-2 py-1 gap-1.5 bg-primary/10 text-primary border-primary/20"
            >
              <CheckCircle2 className="h-3 w-3" />
              {recordCount} registro{recordCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {fileName ? (
          <div
            className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-slate-50/50 to-white p-4 transition-all duration-200 group hover:shadow-sm"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                {getFileIcon(fileName)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                  {fileName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {fileName.split(".").pop()?.toUpperCase()}
                  </Badge>
                  {recordCount !== null && recordCount !== undefined && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 gap-1 bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {recordCount} registros
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className={cn(
                "h-8 w-8 p-0 transition-all",
                isHovering ? "opacity-100" : "opacity-0",
              )}
            >
              <X className="h-4 w-4 text-slate-400 hover:text-destructive transition-colors" />
              <span className="sr-only">Quitar archivo</span>
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02] shadow-md"
                : "border-slate-200 hover:border-primary/50 hover:bg-slate-50/50",
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <div
              className={cn(
                "p-3 rounded-full transition-all duration-200",
                isDragging ? "bg-primary/20" : "bg-slate-100",
              )}
            >
              <UploadCloud
                className={cn(
                  "h-8 w-8 transition-colors",
                  isDragging ? "text-primary" : "text-slate-400",
                )}
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {isDragging
                  ? "Suelta el archivo aquí"
                  : "Arrastra y suelta o haz clic para cargar"}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                Formatos soportados: XLSX, CSV, TSV, TXT
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileSpreadsheet className="h-2.5 w-2.5" />
                XLSX
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText className="h-2.5 w-2.5" />
                CSV
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <File className="h-2.5 w-2.5" />
                TXT
              </Badge>
            </div>
            <Input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
