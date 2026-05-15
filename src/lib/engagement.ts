import { autoReplyToComments } from './instagram.js';

/**
 * Gerencia o engajamento com a comunidade respondendo comentários.
 */
export async function handleCommentsEngagement() {
  console.log('🤖 Iniciando módulo de engajamento...');
  try {
    await autoReplyToComments();
  } catch (error) {
    console.error('❌ Erro no processamento de engajamento:', error);
  }
}
