import { Injectable } from '@nestjs/common';

/**
 * Regex des clés sensibles à ne jamais persister.
 * Couvre : password, secret, privateKey, credentials, ainsi que les variantes
 * ECP `keyStorePass` et `keystore.password` (case-insensitive).
 */
const SENSITIVE_KEY_REGEX = /password|secret|keystore\.password|keystorepass|privatekey|credentials/i;

/**
 * Service de parsing des fichiers Java `.properties` exportés par ECP
 * (Admin ECP > Settings > Runtime Configuration > Export Configuration).
 *
 * Format supporté :
 * - `key = value` (espaces autour du `=` tolérés)
 * - `key=value` (sans espaces)
 * - Lignes commençant par `#` ou `!` : commentaires, ignorées
 * - Lignes blanches ignorées
 * - BOM UTF-8 en entête toléré
 * - Line endings CRLF / LF indifférents
 *
 * Non supporté (volontairement, car ECP n'en émet pas dans les exports) :
 * - Line continuation avec `\` en fin de ligne
 * - Séquences Unicode `\uXXXX`
 * - Clés contenant `=` ou `:` échappés
 *
 * Les valeurs peuvent être vides (ex. `ecp.natEnabled = `) → renvoyées comme
 * chaîne vide, le consommateur décide de les filtrer.
 */
@Injectable()
export class PropertiesParserService {
  parse(buffer: Buffer): Record<string, string> {
    const text = buffer.toString('utf-8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/);
    const out: Record<string, string> = {};
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      if (line.startsWith('#') || line.startsWith('!')) continue;
      const sep = line.indexOf('=');
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim();
      if (key.length === 0) continue;
      if (SENSITIVE_KEY_REGEX.test(key)) continue;
      const value = line.slice(sep + 1).trim();
      out[key] = value;
    }
    return out;
  }
}
