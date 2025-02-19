export interface ArticleData {
  title: string;
  profile: string;
  steps: Array<{
    title: string;
    step_items: Array<{
      content: string;
      children: string[];
    }>;
  }>;
}

export enum ProcessStatus {
  INIT = 'init',
  SCRAPING = 'scraping',
  WAITING_FILE = 'waiting_file',
  PROCESSING = 'processing',
  TRANSLATING = 'translating',
  RENDERING = 'rendering',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export interface LoadingState {
  status: string;
  progress: number;
} 