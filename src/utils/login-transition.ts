/**
 * Ponte entre o login (AuthProvider) e a animação de líquido do layout raiz.
 *
 * `cover()` enche a tela de líquido e só resolve quando ela está toda coberta;
 * aí a sessão vira "authenticated" por baixo e o overlay escoa revelando o app.
 * Sem overlay montado (web, testes) resolve na hora e nada muda no fluxo.
 */
type Handler = () => Promise<void>;

let coverHandler: Handler | null = null;

export const loginTransition = {
  register(handler: Handler) {
    coverHandler = handler;
    return () => {
      if (coverHandler === handler) coverHandler = null;
    };
  },
  cover(): Promise<void> {
    return coverHandler ? coverHandler().catch(() => undefined) : Promise.resolve();
  },
};
