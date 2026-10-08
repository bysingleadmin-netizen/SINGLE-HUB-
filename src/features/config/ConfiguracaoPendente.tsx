import styles from '@/features/auth/auth.module.css'

interface ConfiguracaoPendenteProps {
  faltando: string[]
}

export function ConfiguracaoPendente({ faltando }: ConfiguracaoPendenteProps) {
  return (
    <div className={styles.tela}>
      <div className={`${styles.cartao} fade-up`}>
        <h1 className={styles.titulo}>Configuração pendente</h1>
        <p className={styles.texto}>
          O sistema ainda não está conectado ao Supabase. Preencha as variáveis abaixo no arquivo
          .env (ou no painel da Vercel) e recarregue a página.
        </p>
        <ul className={styles.lista}>
          {faltando.map((nome) => (
            <li key={nome}>
              <code className={styles.variavel}>{nome}</code>
            </li>
          ))}
        </ul>
        <p className={styles.texto}>O passo a passo está em docs/INTEGRACOES.md.</p>
      </div>
    </div>
  )
}
