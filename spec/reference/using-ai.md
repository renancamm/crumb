# AI Authoring Guide

A crumb is just plain text with a small, friendly vocabulary, so an AI is very good at
writing one. Describe your trip in plain language and a chatbot can draft the whole
itinerary as valid Crumb — it's the fastest way to a first version. Let the model rough out
the structure, then open the result in the [live editor](editor.html) to refine it.

## Generate your crumb

Use the ready-made prompt below. It points the model at the format spec, has it ask a few
questions about your trip, then write the crumb for you. Copy it into a new chat, or launch
it straight into ChatGPT or Claude — and if the model can't read the linked spec, hand it
the file with **Download the guide**.

<!-- ai-launcher -->

The model will ask a handful of questions, then reply with a fenced YAML block. You don't
need to read it closely yet — the next step puts it on a map.

## Bring it into the editor

Copy the YAML the model produced, open the [live editor](editor.html), and paste it in. The
map and timeline render as you type, so you can immediately see the route, the days, and
anything the model got wrong — then fix it by hand or ask the model to revise. When you're
happy, save the file straight out of the editor.

## Tips

- **Say what's known, skip the rest.** A bare list of cities is already a valid crumb; add
  dates, stays, and activities as the plan firms up. The model doesn't need to invent detail
  you don't have.
- **Loose values are fine.** "September", "morning", "around 2h" are all valid — match
  precision to what you actually know.
- **Always check it in the editor.** Models occasionally invent fields or misplace
  indentation; the editor's live lint and map make those obvious at a glance.
- **Iterate in the chat.** Once the model has the format in context, follow-ups like "add a
  day trip to Pisa" or "fly home from Rome instead" keep producing valid Crumb.

For the complete vocabulary, see the [Format Specification](crumb-spec.md).
