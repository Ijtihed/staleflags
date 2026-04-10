import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { parseDotenv, isTemplateFile } from '../../src/environment/dotenv.js';
import { parseEnvFiles } from '../../src/environment/dotenv.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');

describe('parseDotenv', () => {
  it('parses KEY=value format', () => {
    const result = parseDotenv('ENABLE_X=true\nFEATURE_Y=false');
    expect(result).toEqual({ ENABLE_X: 'true', FEATURE_Y: 'false' });
  });

  it('parses KEY="value" with double quotes', () => {
    const result = parseDotenv('ENABLE_X="true"');
    expect(result).toEqual({ ENABLE_X: 'true' });
  });

  it("parses KEY='value' with single quotes", () => {
    const result = parseDotenv("ENABLE_X='true'");
    expect(result).toEqual({ ENABLE_X: 'true' });
  });

  it('handles comments', () => {
    const result = parseDotenv('# This is a comment\nENABLE_X=true\n# Another comment');
    expect(result).toEqual({ ENABLE_X: 'true' });
  });

  it('handles empty values', () => {
    const result = parseDotenv('ENABLE_X=');
    expect(result).toEqual({ ENABLE_X: '' });
  });

  it('handles empty quoted values', () => {
    const result = parseDotenv('ENABLE_X=""');
    expect(result).toEqual({ ENABLE_X: '' });
  });

  it('handles export prefix', () => {
    const result = parseDotenv('export ENABLE_X=true');
    expect(result).toEqual({ ENABLE_X: 'true' });
  });

  it('handles blank lines', () => {
    const result = parseDotenv('\n\nENABLE_X=true\n\n');
    expect(result).toEqual({ ENABLE_X: 'true' });
  });

  it('handles values with equals signs', () => {
    const result = parseDotenv('DATABASE_URL=postgres://user:pass@host/db?ssl=true');
    expect(result).toEqual({ DATABASE_URL: 'postgres://user:pass@host/db?ssl=true' });
  });

  // BUG 2 fixes: quoted values with inline comments
  it('KEY="value" # comment → extracts value, strips comment', () => {
    const result = parseDotenv('ENABLE_X="false" # set to "true" to enable');
    expect(result).toEqual({ ENABLE_X: 'false' });
  });

  it("KEY='value' # comment → extracts value, strips comment", () => {
    const result = parseDotenv("ENABLE_X='false' # set to true");
    expect(result).toEqual({ ENABLE_X: 'false' });
  });

  it('KEY=value # comment → strips inline comment for unquoted', () => {
    const result = parseDotenv('ENABLE_X=false # this is a comment');
    expect(result).toEqual({ ENABLE_X: 'false' });
  });

  it('KEY="value with # inside" → hash inside quotes is preserved', () => {
    const result = parseDotenv('ENABLE_X="value with # inside"');
    expect(result).toEqual({ ENABLE_X: 'value with # inside' });
  });

  it('the cal.com case: KEY="false" # set to "true" to enable', () => {
    const result = parseDotenv('ENABLE_ASYNC_TASKER="false" # set to "true" to enable');
    expect(result).toEqual({ ENABLE_ASYNC_TASKER: 'false' });
  });
});

describe('isTemplateFile', () => {
  it('identifies .env.example as template', () => {
    expect(isTemplateFile('.env.example')).toBe(true);
  });

  it('identifies .env.sample as template', () => {
    expect(isTemplateFile('.env.sample')).toBe(true);
  });

  it('identifies .env.template as template', () => {
    expect(isTemplateFile('.env.template')).toBe(true);
  });

  it('identifies .env.dev.example as template', () => {
    expect(isTemplateFile('.env.dev.example')).toBe(true);
  });

  it('identifies .env.production.sample as template', () => {
    expect(isTemplateFile('.env.production.sample')).toBe(true);
  });

  it('.env is NOT a template', () => {
    expect(isTemplateFile('.env')).toBe(false);
  });

  it('.env.development is NOT a template', () => {
    expect(isTemplateFile('.env.development')).toBe(false);
  });

  it('.env.staging is NOT a template', () => {
    expect(isTemplateFile('.env.staging')).toBe(false);
  });

  it('.env.production is NOT a template', () => {
    expect(isTemplateFile('.env.production')).toBe(false);
  });

  it('.env.local is NOT a template', () => {
    expect(isTemplateFile('.env.local')).toBe(false);
  });

  it('.env.test is NOT a template', () => {
    expect(isTemplateFile('.env.test')).toBe(false);
  });
});

describe('parseEnvFiles', () => {
  it('finds all .env variants', async () => {
    const envMap = await parseEnvFiles(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(envMap.has('ENABLE_NEW_CHECKOUT')).toBe(true);
    const vals = envMap.get('ENABLE_NEW_CHECKOUT')!;
    expect(vals.size).toBe(3);
    expect(vals.has('.env.development')).toBe(true);
    expect(vals.has('.env.staging')).toBe(true);
    expect(vals.has('.env.production')).toBe(true);
  });

  it('filters out non-flag keys', async () => {
    const envMap = await parseEnvFiles(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    expect(envMap.has('DATABASE_URL')).toBe(false);
    expect(envMap.has('PORT')).toBe(false);
  });

  it('handles missing .env files gracefully', async () => {
    const envMap = await parseEnvFiles(path.join(FIXTURES, 'repo-empty'), DEFAULT_CONFIG);
    expect(envMap.size).toBe(0);
  });

  it('parses values correctly across environments', async () => {
    const envMap = await parseEnvFiles(path.join(FIXTURES, 'repo-mixed'), DEFAULT_CONFIG);
    const darkMode = envMap.get('FEATURE_DARK_MODE')!;
    expect(darkMode.get('.env.development')).toBe('true');
    expect(darkMode.get('.env.staging')).toBe('true');
    expect(darkMode.get('.env.production')).toBe('false');
  });

  it('excludes .env.example template files from the map', async () => {
    const envMap = await parseEnvFiles(path.join(FIXTURES, 'repo-templates'), DEFAULT_CONFIG);
    // .env.example is a template → excluded → map should be empty
    expect(envMap.size).toBe(0);
  });
});
