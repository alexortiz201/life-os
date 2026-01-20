import { IngestionPipelineEnvelope } from "../ingestion/ingestion.types";

type PreGuardOk = { ok: true; env: IngestionPipelineEnvelope };
type PreGuardFail = { ok: false; env: IngestionPipelineEnvelope };
export type PreGuardResult = PreGuardOk | PreGuardFail;
