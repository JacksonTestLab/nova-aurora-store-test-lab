import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { navigate, config } = useApp();

  return (
    <footer
      data-testid="global-footer"
      className="no-print border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 mt-auto"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
          <span className="font-medium text-slate-800 dark:text-slate-200">
            Nova Aurora Store · Plataforma de Testes QA
          </span>
          <span aria-hidden="true">·</span>
          <span>v{config.version}</span>
          <span aria-hidden="true">·</span>
          <span>
            Desenvolvido por{' '}
            <strong className="font-semibold text-slate-900 dark:text-white">
              Jackson Mendes | Analista de QA
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/laboratorio')}
            data-testid="footer-lab-guide-link"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium whitespace-nowrap"
          >
            Guia de Cenários QA
          </button>
          <a
            href="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-swagger-link"
            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium whitespace-nowrap"
          >
            API Swagger
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/JacksonTestLab"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-github-link"
            className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium whitespace-nowrap"
          >
            GitHub
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://www.linkedin.com/in/jackson-mendes-a4731a2b3/"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-linkedin-link"
            className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium whitespace-nowrap"
          >
            LinkedIn
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </footer>
  );
};
