<script>
  import { ChevronLeft } from "lucide-svelte";
</script>

<div class="min-h-screen pb-20">
  <!-- Header -->
  <div
    class="glass-panel sticky top-0 z-40 border-b border-white/5 bg-slate-900/80 backdrop-blur-xl"
  >
    <div class="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
      <a
        href="/"
        class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={24} />
      </a>
      <h1 class="font-bold text-lg">プライバシーポリシー</h1>
    </div>
  </div>

  <div
    class="max-w-3xl mx-auto px-4 py-8 space-y-8 text-slate-300 leading-relaxed"
  >
    <div class="glass-panel p-6 rounded-xl space-y-6">
      <section>
        <h2 class="text-xl font-bold text-white mb-4">
          1. ユーザー情報の収集と利用
        </h2>
        <p>
          TriLinesAt（以下、「本アプリ」）は、OAuth認証を利用してBlueskyアカウントと連携します。
          本アプリは、Bluesky上で公開されているプロフィール情報（ハンドル名、表示名、アバター画像など）を取得し、アプリ内での表示に利用します。
          これらの情報は、ユーザーの端末内またはブラウザのキャッシュに一時的に保存されますが、開発者が管理するサーバーに送信・保存されることはありません。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">2. 日記データの扱い</h2>
        <p>
          本アプリで作成された日記データは、AT
          Protocolに基づいて、ユーザー自身のPersonal Data Server (PDS)
          に保存されます。
          PDSに保存されたデータは、技術的にはBlueskyの他のポストと同様に公開情報として扱われます。
          本アプリは、ユーザーが作成した日記データをアプリ内での表示およびBlueskyへのシェア（ユーザーが選択した場合）以外の目的で利用することはありません。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">
          3. アクセス解析ツールについて
        </h2>
        <p>
          本アプリでは、サービスの品質向上のため、Cloudflare Web
          Analyticsなどのアクセス解析ツールを利用することがあります。
          これにより収集されるデータは匿名化されており、個人を特定するものではありません。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">
          4. プライバシーポリシーの変更
        </h2>
        <p>
          開発者は、必要に応じて本ポリシーを変更することがあります。
          重要な変更がある場合には、本アプリ内または適切な方法でユーザーに通知します。
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-white mb-4">5. お問い合わせ</h2>
        <p>
          本ポリシーに関するお問い合わせは、Bluesky上の開発者アカウント（@suibari.com）までご連絡ください。
        </p>
      </section>
    </div>
  </div>
</div>
