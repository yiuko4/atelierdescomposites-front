import DxfViewer from "@/components/DxfViewer2";
import Head from "next/head";
import React, { useState } from "react";

const DxfViewerPage: React.FC = () => {
  const [dxfFile, setDxfFile] = useState<File | null>(null);
  const [dxfUrl, setDxfUrl] = useState<string | undefined>("/fichier test.dxf"); // Default to the test file

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDxfFile(file);
      setDxfUrl(undefined); // Clear URL if a file is selected
    } else {
      setDxfFile(null);
    }
  };

  return (
    <>
      <Head>
        <title>Visualiseur DXF</title>
        <meta name="description" content="Visualisez vos fichiers DXF" />
      </Head>
      <div style={{ padding: "20px" }}>
        <h1>Visualiseur de Fichier DXF</h1>

        <div>
          <label htmlFor="dxfFileInput">Choisir un fichier DXF : </label>
          <input
            type="file"
            id="dxfFileInput"
            accept=".dxf"
            onChange={handleFileChange}
          />
        </div>

        {(dxfFile || dxfUrl) && (
          <div style={{ marginTop: "20px" }}>
            <DxfViewer dxfFile={dxfFile || undefined} dxfUrl={dxfUrl} />
          </div>
        )}

        {!dxfFile && !dxfUrl && (
          <p style={{ marginTop: "20px" }}>
            Veuillez sélectionner un fichier DXF à visualiser ou un fichier par
            défaut sera chargé.
          </p>
        )}

        <p style={{ marginTop: "20px" }}>
          Le fichier DXF par défaut est <code>public/fichier test.dxf</code>.
        </p>
      </div>
    </>
  );
};

export default DxfViewerPage;
