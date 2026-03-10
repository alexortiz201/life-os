import z from "zod";
import { IntakeSourceSchema, NoteIntakeSchema } from "./intake.schemas";


export type NoteIntake = z.infer<typeof NoteIntakeSchema>;
export type IntakeSource = z.infer<typeof IntakeSourceSchema>;