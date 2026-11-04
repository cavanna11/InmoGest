'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { Alert, Badge } from '@/components/ui/surfaces.tsx';
import { confirmImportAction, previewImportAction, type ImportResult, type PreviewResult } from './actions.ts';
import { toCsv } from './csv.ts';
import type { ImportKind } from './rows.ts';

// Importación en tres pasos: elegir archivo → vista previa con errores por fila → confirmar (CU-12).

function downloadRejected(rows: Array<{ line: number; label?: string; error: string }>) {
  const csv = toCsv([['linea', 'dato', 'error'], ...rows.map((row) => [row.line, row.label ?? '', row.error])]);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'filas-rechazadas.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const [kind, setKind] = useState<ImportKind>('contactos');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [localError, setLocalError] = useState('');
  const [pending, startTransition] = useTransition();

  function reset() {
    setText('');
    setFileName('');
    setPreview(null);
    setResult(null);
    setLocalError('');
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 2_500_000) {
      setLocalError('El archivo es demasiado grande (máximo 2,5 MB).');
      return;
    }
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    startTransition(async () => setPreview(await previewImportAction(kind, content)));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <Select
          aria-label="Qué vas a importar"
          value={kind}
          className="sm:w-44"
          onChange={(event) => {
            setKind(event.target.value as ImportKind);
            reset();
          }}
        >
          <option value="contactos">Contactos</option>
          <option value="propiedades">Propiedades</option>
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/panel/importar/plantilla?tipo=${kind}`}>Descargar plantilla</a>
          </Button>
          <label htmlFor="csv-file" className="sr-only">
            Archivo CSV
          </label>
          <input
            id="csv-file"
            key={fileName || 'empty'}
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={(event) => void onFile(event.currentTarget.files?.[0])}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
      </div>
      {localError ? <Alert variant="destructive">{localError}</Alert> : null}
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Procesando el archivo…
        </p>
      ) : null}

      {result ? (
        result.ok ? (
          <div className="grid gap-3">
            <Alert variant="success">
              Importamos {result.imported} {result.imported === 1 ? 'fila' : 'filas'}.
              {result.rejected.length > 0 ? ` ${result.rejected.length} no se importaron.` : ''}
            </Alert>
            {result.rejected.length > 0 ? <IssueList issues={result.rejected} /> : null}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={reset}>
              Importar otro archivo
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">{result.error}</Alert>
        )
      ) : preview ? (
        preview.ok ? (
          <div className="grid gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Vista previa de {fileName}:
              <Badge variant="success">{preview.valid.length} listas</Badge>
              {preview.invalid.length > 0 ? <Badge variant="destructive">{preview.invalid.length} con errores</Badge> : null}
            </p>
            {preview.invalid.length > 0 ? <IssueList issues={preview.invalid} /> : null}
            {preview.valid.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">Ver las filas que se van a importar</summary>
                <ul className="mt-2 grid max-h-64 gap-1 overflow-y-auto text-sm">
                  {preview.valid.map((row) => (
                    <li key={row.line} className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">Línea {row.line}</span>
                      {row.label}
                      {row.warning ? <Badge variant="warning">{row.warning}</Badge> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || preview.valid.length === 0}
                onClick={() => startTransition(async () => setResult(await confirmImportAction(kind, text)))}
              >
                Importar {preview.valid.length} {preview.valid.length === 1 ? 'fila' : 'filas'}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={reset}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Alert variant="destructive">{preview.error}</Alert>
        )
      ) : null}
    </div>
  );
}

function IssueList({ issues }: { issues: Array<{ line: number; label?: string; error: string }> }) {
  return (
    <div className="grid gap-2">
      <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm">
        {issues.map((issue) => (
          <li key={issue.line} className="rounded-md border border-destructive/40 px-3 py-1.5">
            <span className="font-medium">Línea {issue.line}</span>
            {issue.label ? ` · ${issue.label}` : ''}: {issue.error}
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => downloadRejected(issues)}>
        Descargar filas con error
      </Button>
    </div>
  );
}
