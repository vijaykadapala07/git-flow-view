/** The part of a view definition the browser needs to show the view tabs. */
export interface FlowViewSummary {
  id: string;
  title: string;
  /** Branch the view reads, when known. */
  branch?: string;
}

export const flowViewIdPattern = /^[a-z0-9-]{1,40}$/;
