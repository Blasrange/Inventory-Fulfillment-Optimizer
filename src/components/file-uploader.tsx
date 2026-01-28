"use client";
import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

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

  // This logic resets the file uploader when the parent tells it to
  // (e.g. when changing client)
  if (recordCount === null && fileName !== null) {
    handleReset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex justify-between items-center">
          <span>{title}</span>
          {recordCount !== null && recordCount !== undefined && fileName && (
            <span className="text-sm font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {recordCount} registros
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fileName ? (
          <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground truncate">
                {fileName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Quitar archivo</span>
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50",
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-semibold">
              Arrastra y suelta o haz clic para cargar
            </p>
            <p className="text-sm text-muted-foreground">
              XLSX, CSV, TSV o texto plano
            </p>
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
