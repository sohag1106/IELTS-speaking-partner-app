/** Map server ack error codes to friendly copy for exam actions. */
const messages: Record<string, string> = {
  not_examiner: 'Only the examiner can do that.',
  not_ready: 'Both players must be ready first.',
  bad_part: 'That part cannot be started right now.',
  bad_card: 'Choose one of the three cue cards.',
  part2_active: 'Part 2 is running — hide the card first.',
  part3_required: 'Run Part 3 before submitting a score.',
  already_scored: 'This round has already been scored.',
  bad_band: 'Score must be a half-band between 0 and 9.',
  round_finished: 'This round is already finished.',
  not_in_match: 'You are not in a match.',
  not_active: 'No cue card is showing right now.',
  not_started: 'Start Part 1 before asking follow-up questions.',
  bad_text: 'Type a question first.',
  completed: 'This match is already finished.',
  rate_limited: 'Too many attempts — wait a moment and try again.',
  internal: 'Something went wrong — please try again.',
};

export function examError(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  return messages[code] ?? (code || messages.internal);
}
