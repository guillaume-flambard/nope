// ═══════════════════════════════════════
// NOPE. — Type System
// ═══════════════════════════════════════

/** Call lifecycle states */
export type CallStatus =
  | 'preparing'    // Parsing goal, finding company
  | 'dialing'      // Initiating the call
  | 'ivr'          // Navigating phone menu
  | 'holding'      // Waiting on hold
  | 'talking'      // Talking to human agent
  | 'negotiating'  // Active negotiation/request
  | 'success'      // Goal achieved
  | 'failed'       // Could not complete
  | 'ended';       // Call terminated

/** What the user wants Nope to do */
export type StrategyType = 'cancel' | 'negotiate' | 'appointment' | 'inquiry' | 'complain';

/** Supported languages */
export type Language = 'en' | 'fr' | 'es' | 'de' | 'it';

/** A task for Nope to execute */
export interface CallTask {
  id: string;
  goal: string;               // Natural language: "Cancel my Netflix"
  company?: string;            // Extracted: "Netflix"
  strategy: StrategyType;
  language: Language;
  phoneNumber?: string;        // Auto-discovered or provided
  userContext?: string;         // Additional info ("account #12345")
  createdAt: Date;
}

/** A single turn in the conversation */
export interface TranscriptEntry {
  timestamp: Date;
  speaker: 'nope' | 'agent' | 'ivr' | 'system';
  text: string;
  action?: string;             // "pressed_2", "on_hold", "transferred"
  confidence?: number;         // STT confidence 0-1
}

/** Final result of a call */
export interface CallResult {
  taskId: string;
  status: 'success' | 'partial' | 'failed';
  summary: string;
  transcript: TranscriptEntry[];
  duration: number;            // seconds
  savings?: number;            // $ saved if negotiation
  nextSteps?: string;          // "Confirmation email sent to..."
  cost: CallCost;
}

/** Cost breakdown */
export interface CallCost {
  twilio: number;              // Telephony cost
  llm: number;                 // LLM tokens cost
  stt: number;                 // Speech-to-text cost
  tts: number;                 // Text-to-speech cost
  total: number;
}

/** Company directory entry */
export interface CompanyInfo {
  name: string;
  phone: string;
  country: string;
  category: string;            // "streaming", "telecom", "energy"...
  language: Language;
  ivrHints?: IVRHint[];        // Known menu shortcuts
  tips?: string;               // "Press 2 then 4 for cancellation"
}

/** Known IVR menu shortcut */
export interface IVRHint {
  description: string;         // "Cancellation department"
  keys: string;                // "2,4" or "0" for operator
}

/** Conversation strategy definition */
export interface Strategy {
  type: StrategyType;
  systemPrompt: string;
  openingLine: string;
  tactics: string[];
  successCriteria: string[];
  failureHandling: string;
  ivrTarget: string[];         // Keywords to look for in IVR
  maxAttempts: number;
}

/** Voice pipeline configuration */
export interface VoicePipelineConfig {
  sttProvider: 'openai' | 'deepgram' | 'groq';
  llmProvider: 'openai' | 'anthropic' | 'groq';
  llmModel: string;
  ttsProvider: 'openai' | 'elevenlabs' | 'groq';
  ttsVoice: string;
  language: Language;
}

/** Events emitted during a call */
export interface NopeEvent {
  type: 'status' | 'transcript' | 'action' | 'error' | 'result' | 'cost';
  timestamp: Date;
  taskId: string;
  data: any;
}

/** Event handler type */
export type NopeEventHandler = (event: NopeEvent) => void;

/** Live call phase tracking */
export type CallPhase = 'connecting' | 'ivr' | 'holding' | 'talking' | 'negotiating' | 'ending';

/** Result from TwilioStreamHandler.waitForCompletion() */
export interface StreamResult {
  status: 'success' | 'partial' | 'failed';
  summary: string;
  transcript: TranscriptEntry[];
  duration: number;
  savings?: number;
  twilioCallSid: string;
  endReason: 'completed' | 'busy' | 'failed' | 'no-answer' | 'hangup' | 'error';
}

/** Typed Twilio Media Stream WebSocket messages */
export type TwilioStreamMessage =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start'; sequenceNumber: string; start: { streamSid: string; accountSid: string; callSid: string; tracks: string[]; mediaFormat: { encoding: string; sampleRate: number; channels: number } } }
  | { event: 'media'; sequenceNumber: string; media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop'; sequenceNumber: string; stop: { accountSid: string; callSid: string } }
  | { event: 'mark'; sequenceNumber: string; mark: { name: string } };
