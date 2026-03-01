# kirei photo

AI-powered photo enhancer that upscales images to 4x resolution. Free to use, no sign-up required.

**Live:** [kireiphoto.pages.dev](https://kireiphoto.pages.dev)

## Architecture

```text
Browser → Cloudflare Pages (Nuxt) → Hugging Face Space (Gradio API) → Real-ESRGAN
```

1. User uploads a photo
2. Nuxt server API sends the image to a Hugging Face Space running Real-ESRGAN
3. AI performs 4x super-resolution on the image
4. Server proxies the result back to the browser (no external URLs are exposed to the client)
5. Client-side Canvas post-processing: contrast, saturation, and unsharp mask

## Tech Stack

- **Framework:** Nuxt 4 (Vue 3)
- **UI:** Nuxt UI v4 (Tailwind CSS v4)
- **AI Model:** [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (4x upscaling)
- **AI Hosting:** Hugging Face Spaces (Gradio API)
- **Deployment:** Cloudflare Pages
- **Runtime:** Bun

## Features

- 4x AI super-resolution via Real-ESRGAN
- Client-side post-processing (contrast, saturation, sharpening)
- Before/After comparison slider
- Wake Lock API to prevent screen sleep during processing
- Mobile-first responsive design
- Zero data retention — images are deleted immediately after processing

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Build for production
bun run build

# Deploy to Cloudflare Pages
bun run deploy
```

## Environment Variables

| Variable             | Description                        |
| -------------------- | ---------------------------------- |
| `NUXT_HF_SPACE_URL`  | Hugging Face Space URL (required)  |

Set secrets on Cloudflare Pages:

```bash
npx wrangler pages secret put NUXT_HF_SPACE_URL --project-name kireiphoto
```

## Project Structure

```text
app/
├── pages/index.vue          # Main page (upload → process → result)
├── components/              # ComparisonSlider (before/after)
├── composables/             # useImageEnhance (processing logic)
└── layouts/                 # Default layout

server/
├── api/enhance/index.post.ts  # AI enhancement endpoint
└── utils/gradio.ts            # Gradio API client

huggingface-space/
├── app.py                   # Real-ESRGAN Gradio app
└── requirements.txt
```

## License

MIT
