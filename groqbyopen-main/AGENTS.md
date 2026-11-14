<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Original app lives in src/app (client-only via src/routes/index.tsx); its Express server code is in src/server-app, served through a mini Express adapter by src/routes/api/$.ts and src/routes/preview.$id.ts — keeps the imported app's code unchanged.
- src/app/firebase.ts keeps the original Firebase function names but is backed by Lovable Cloud — so components didn't need edits.

- The entry screen mounts InteractiveRevealModal with a shared login modal; AttachmentGrid is shared by welcome, chat composer and sent messages to keep attachment presentation consistent.
- Chat subscriptions return one entry per conversation, and mergeChatThreads preserves newer local messages while saves finish; duplicated title/id aliases cause duplicate history rows.
