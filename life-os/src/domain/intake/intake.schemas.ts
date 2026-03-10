import z from "zod"

export const IntakeSourceSchema = z.enum(["manual", "import"])

export const NoteIntakeSchema = z.object({
	text: z.string().min(1),
	tags: z.array(z.string()).default([]),
	source: IntakeSourceSchema.default("manual")
})