import { ai } from '../genkit';
import { z } from 'zod';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

export const browserTool = ai.defineTool(
  {
    name: 'browserbaseWebSearch',
    description: 'Automates a cloud browser to navigate, extract HTML/text, and research the web. Provide EITHER a url to navigate directly, OR a query to perform a Google search.',
    inputSchema: z.object({
      url: z.string().url().optional(),
      query: z.string().optional(),
      action: z.enum(['extract_text', 'screenshot']),
    }),
    outputSchema: z.object({
      status: z.string(),
      message: z.string(),
      data: z.unknown(),
    }),
  },
  async (input) => {
    try {
      const browserbase = new Browserbase({
        apiKey: process.env.BROWSERBASE_API_KEY,
      });

      const projectId = process.env.BROWSERBASE_PROJECT_ID;
      if (!projectId) {
        throw new Error('Missing BROWSERBASE_PROJECT_ID in environment variables');
      }

      const session = await browserbase.sessions.create({
        projectId: projectId,
      });

      const connectUrl = session.connectUrl;
      if (!connectUrl) {
        throw new Error('Failed to retrieve connectUrl from Browserbase session');
      }

      const browser = await chromium.connectOverCDP(connectUrl, { timeout: 15000 });
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0] || (await defaultContext.newPage());

      let targetUrl = input.url;
      if (!targetUrl && input.query) {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(input.query)}`;
      } else if (!targetUrl) {
        throw new Error('You must provide either a url or a query');
      }

      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        let resultData: Record<string, unknown> = {};
        
        if (input.action === 'extract_text') {
          const textContent = await page.evaluate(() => document.body.innerText);
          resultData = { html: textContent };
        } else if (input.action === 'screenshot') {
          const screenshotBuffer = await page.screenshot({ fullPage: true });
          resultData = { screenshotBase64: screenshotBuffer.toString('base64') };
        }

        return {
          status: 'success',
          message: `Successfully executed ${input.action} on ${input.url || input.query || 'page'}.`,
          data: resultData,
        };
      } finally {
        await browser.close().catch(console.error);
        await browserbase.sessions.update(session.id, {
          status: 'REQUEST_RELEASE',
        }).catch(console.error);
      }
    } catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      };
    }
  }
);
