import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('829 memory render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <TriangleAlert size={34} />
        <h1>页面出现异常</h1>
        <p>学习记录仍保存在本机。重新加载后可以继续复习。</p>
        <button type="button" className="primary-button" onClick={() => window.location.reload()}>
          <RefreshCw size={18} />重新加载
        </button>
      </main>
    );
  }
}
