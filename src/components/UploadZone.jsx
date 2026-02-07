import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const UploadZone = ({ onUpload }) => {
    const onDrop = useCallback(acceptedFiles => {
        // Sort files by name to maintain proper order (1, 2, 3... instead of 6, 5, 4...)
        const sortedFiles = [...acceptedFiles].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        onUpload(sortedFiles);
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.webp']
        }
    });

    return (
        <div
            {...getRootProps()}
            className={`upload-zone ${isDragActive ? 'drag-over' : ''}`}
            style={{
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <input {...getInputProps()} />

            <div className="upload-zone__icon">
                {isDragActive ? '📂' : '📁'}
            </div>

            <h2 className="upload-zone__title">
                {isDragActive ? "Drop to upload..." : "Drop images here"}
            </h2>

            <p className="upload-zone__subtitle">
                or click to browse • Supports JPG, PNG, WebP
            </p>

            <div style={{
                marginTop: 'var(--space-xl)',
                display: 'flex',
                gap: 'var(--space-lg)',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                {['4:5 Instagram', '1:1 Square', '16:9 Landscape', '9:16 Story'].map((format) => (
                    <span
                        key={format}
                        className="badge"
                        style={{ opacity: 0.6 }}
                    >
                        {format}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default UploadZone;
