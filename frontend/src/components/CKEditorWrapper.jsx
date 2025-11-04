import React from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { AlertCircle, FileText, Type, Maximize2 } from 'lucide-react';

const CKEditorWrapper = ({
  value,
  onChange,
  placeholder = "Escribe aquí tu descripción...",
  disabled = false,
  maxLength = 5000,
  validationError = false,
  onValidationChange,
}) => {
  const [charCount, setCharCount] = React.useState(0);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Configuración mejorada con más opciones
  const editorConfiguration = {
    toolbar: [
      'heading',
      '|',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'subscript',
      'superscript',
      '|',
      'fontSize',
      'fontFamily',
      'fontColor',
      'fontBackgroundColor',
      '|',
      'alignment',
      '|',
      'bulletedList',
      'numberedList',
      '|',
      'outdent',
      'indent',
      '|',
      'link',
      'imageUpload',
      'blockQuote',
      'insertTable',
      'mediaEmbed',
      'code',
      'codeBlock',
      'horizontalLine',
      '|',
      'removeFormat',
      '|',
      'undo',
      'redo'
    ],
    placeholder: placeholder,
    
    // Configuración de enlaces mejorada
    link: {
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: 'Abrir en nueva pestaña',
          defaultValue: true,
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      },
      addTargetToExternalLinks: true
    },

    // Configuración de tabla mejorada
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        'tableProperties',
        'tableCellProperties'
      ]
    },

    // Configuración de imágenes
    image: {
      toolbar: [
        'imageTextAlternative',
        'toggleImageCaption',
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        'linkImage'
      ],
      styles: [
        'full',
        'side',
        'alignLeft',
        'alignCenter',
        'alignRight'
      ]
    },

    // Subida de imágenes (puedes configurar tu endpoint)
    // simpleUpload: {
    //   uploadUrl: '/api/upload-image',
    //   headers: {
    //     'X-CSRF-TOKEN': 'CSRF-Token',
    //     Authorization: 'Bearer <JSON Web Token>'
    //   }
    // },

    // Configuración de encabezados
    heading: {
      options: [
        { model: 'paragraph', title: 'Párrafo', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Encabezado 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Encabezado 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Encabezado 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Encabezado 4', class: 'ck-heading_heading4' }
      ]
    },

    // Tamaños de fuente
    fontSize: {
      options: [
        'tiny',
        'small',
        'default',
        'big',
        'huge'
      ]
    },

    // Familias de fuente
    fontFamily: {
      options: [
        'default',
        'Arial, Helvetica, sans-serif',
        'Courier New, Courier, monospace',
        'Georgia, serif',
        'Lucida Sans Unicode, Lucida Grande, sans-serif',
        'Tahoma, Geneva, sans-serif',
        'Times New Roman, Times, serif',
        'Trebuchet MS, Helvetica, sans-serif',
        'Verdana, Geneva, sans-serif'
      ]
    },

    // Alineación
    alignment: {
      options: ['left', 'center', 'right', 'justify']
    },

    // Configuración de media embed (YouTube, Vimeo, etc)
    mediaEmbed: {
      previewsInData: true
    },

    // Configuración de código
    codeBlock: {
      languages: [
        { language: 'plaintext', label: 'Texto plano' },
        { language: 'javascript', label: 'JavaScript' },
        { language: 'python', label: 'Python' },
        { language: 'java', label: 'Java' },
        { language: 'php', label: 'PHP' },
        { language: 'html', label: 'HTML' },
        { language: 'css', label: 'CSS' },
        { language: 'sql', label: 'SQL' }
      ]
    }
  };

  const handleEditorChange = (event, editor) => {
    const data = editor.getData();
    const plainText = data.replace(/<[^>]*>/g, '');
    
    // Actualizar contador
    setCharCount(plainText.length);
    
    // Validar longitud
    if (maxLength && plainText.length > maxLength) {
      onValidationChange?.(true);
      return;
    } else {
      onValidationChange?.(false);
    }
    
    onChange(data);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 transition-all duration-200 ${
        isFocused
          ? 'border-blue-400 ring-2 ring-blue-100'
          : validationError
          ? 'border-red-300'
          : 'border-gray-200'
      } ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}
    >
      {/* Header del editor */}
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-600">
          <FileText className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Editor de texto enriquecido</span>
          <span className="sm:hidden">Editor</span>
        </div>
        
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-600" />
        </button>
      </div>

      {/* CKEditor */}
      <div className={`p-3 ${isFullscreen ? 'h-[calc(100%-8rem)] overflow-auto' : ''}`}>
        <div className="ckeditor-wrapper">
          <CKEditor
            editor={ClassicEditor}
            config={editorConfiguration}
            data={value || ''}
            onChange={handleEditorChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
          />
        </div>

        {/* Información y contador */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-gray-500">
            <span className="flex items-center gap-1">
              <Type className="h-3 w-3" />
              {charCount} caracteres
            </span>
            {maxLength && (
              <span className={`font-medium ${
                charCount > maxLength * 0.9 ? 'text-orange-600' : ''
              } ${charCount > maxLength ? 'text-red-600' : ''}`}>
                {maxLength - charCount} restantes
              </span>
            )}
          </div>
          
          {maxLength && (
            <div className="text-gray-400">
              Máximo: {maxLength}
            </div>
          )}
        </div>
      </div>

      {/* Error de validación */}
      {validationError && (
        <div className="border-t border-gray-100 bg-red-50 px-3 py-2 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1 text-red-600" />
          <span className="text-xs text-red-700">
            Límite de caracteres excedido
          </span>
        </div>
      )}


    </div>
  );
};

export default CKEditorWrapper;