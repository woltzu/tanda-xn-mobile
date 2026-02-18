/**
 * TandaXn Screen: PAY-401 Account Added Success
 * Payment Methods Module - Success (4XX Series)
 * 
 * 
 * Confirmation after linking account
 * 
 * Brand: #0A2342 (Navy), #00C6AE (Teal), #F5F7FA (Background)
 */

const AccountAddedSuccessScreen = ({ 
  account = {
    type: "bank", // bank, card, mobilemoney
    name: "Chase Bank",
    last4: "4532",
    accountType: "Checking"
  },
  onAddFunds,
  onViewMethods,
  onDone
}) => {
  const getIcon = () => {
    switch (account.type) {
      case "bank": return "🏦";
      case "card": return "💳";
      case "mobilemoney": return "📱";
      default: return "✓";
    }
  };

  const getTitle = () => {
    switch (account.type) {
      case "bank": return "Bank Account Linked!";
      case "card": return "Card Added!";
      case "mobilemoney": return "Mobile Money Linked!";
      default: return "Account Added!";
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F5F7FA",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paddingBottom: "140px"
    }}>
      {/* Success Header - Navy */}
      <div style={{
        background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
        padding: "60px 20px 100px 20px",
        textAlign: "center",
        color: "#FFFFFF"
      }}>
        <div style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: "rgba(0,198,174,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px auto"
        }}>
          <div style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "#00C6AE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>
          {getTitle()} 🎉
        </h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>
          You can now use this for deposits and withdrawals
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Account Card */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "16px",
          border: "1px solid #E5E7EB",
          textAlign: "center"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "#F5F7FA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            fontSize: "32px"
          }}>
            {getIcon()}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
            {account.name}
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
            {account.accountType} •••• {account.last4}
          </p>
          
          <div style={{
            marginTop: "16px",
            padding: "12px",
            background: "#F0FDFB",
            borderRadius: "10px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#00897B" }}>Verified</span>
          </div>
        </div>

        {/* What You Can Do */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "16px",
          border: "1px solid #E5E7EB"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What You Can Do Now
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "↓", text: "Add funds to your wallet", color: "#00C6AE" },
              { icon: "↑", text: "Withdraw to this account", color: "#0A2342" },
              { icon: "→", text: "Make circle contributions", color: "#00C6AE" }
            ].map((item, idx) => (
              <div key={idx} style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px"
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: item.color === "#00C6AE" ? "#F0FDFB" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  color: item.color
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: "14px", color: "#0A2342" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Action */}
        <button
          onClick={onAddFunds}
          style={{
            width: "100%",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
            border: "2px solid #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "#00C6AE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
              Add Funds Now
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Start saving with your new account
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Bottom Buttons */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FFFFFF",
        padding: "16px 20px 32px 20px",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        gap: "12px"
      }}>
        <button
          onClick={onViewMethods}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "16px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer"
          }}
        >
          View All Methods
        </button>
        <button
          onClick={onDone}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer"
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default AccountAddedSuccessScreen;
