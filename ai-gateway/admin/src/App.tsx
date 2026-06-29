import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { Zap } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Models from "@/pages/Models";
import HistoryPage from "@/pages/History";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-panel-primary">
        {/* 顶部导航栏 */}
        <nav className="sticky top-0 z-50 bg-panel-secondary/90 backdrop-blur-md border-b border-panel-border">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* 左侧标题 */}
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              <span className="text-lg font-bold text-white">AI Gateway Admin</span>
            </div>
            {/* 右侧导航 */}
            <div className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/20 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-panel-card/50'
                  }`
                }
              >
                仪表盘
              </NavLink>
              <NavLink
                to="/models"
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/20 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-panel-card/50'
                  }`
                }
              >
                渠道管理
              </NavLink>
              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/20 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-panel-card/50'
                  }`
                }
              >
                历史记录
              </NavLink>
            </div>
          </div>
        </nav>

        {/* 页面内容 */}
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/models" element={<Models />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
