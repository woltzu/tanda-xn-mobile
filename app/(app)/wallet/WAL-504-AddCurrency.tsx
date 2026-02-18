"use client"

import { ArrowLeft, Search, Check, Info, Globe } from "lucide-react"
import { useState } from "react"

export default function AddCurrencyScreen() {
  const availableCurrencies = [
    { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦", popular: true, region: "West Africa" },
    { code: "GHS", name: "Ghanaian Cedi", flag: "🇬🇭", symbol: "₵", popular: true, region: "West Africa" },
    { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh", popular: true, region: "East Africa" },
    { code: "TZS", name: "Tanzanian Shilling", flag: "🇹🇿", symbol: "TSh", popular: false, region: "East Africa" },
    { code: "UGX", name: "Ugandan Shilling", flag: "🇺🇬", symbol: "USh", popular: false, region: "East Africa" },
    { code: "ZAR", name: "South African Rand", flag: "🇿🇦", symbol: "R", popular: true, region: "Southern Africa" },
    { code: "MAD", name: "Moroccan Dirham", flag: "🇲🇦", symbol: "DH", popular: false, region: "North Africa" },
    { code: "EGP", name: "Egyptian Pound", flag: "🇪🇬", symbol: "E£", popular: false, region: "North Africa" },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", symbol: "C$", popular: false, region: "North America" },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", symbol: "CHF", popular: false, region: "Europe" },
  ]

  const existingCurrencies = ["USD", "EUR", "GBP", "XOF"]

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])

  const filteredCurrencies = availableCurrencies.filter(
    (c) =>
      !existingCurrencies.includes(c.code) &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.region.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const popularCurrencies = filteredCurrencies.filter((c) => c.popular)
  const otherCurrencies = filteredCurrencies.filter((c) => !c.popular)

  const toggleCurrency = (code: string) => {
    if (selectedCurrencies.includes(code)) {
      setSelectedCurrencies(selectedCurrencies.filter((c) => c !== code))
    } else {
      setSelectedCurrencies([...selectedCurrencies, code])
    }
  }

  const CurrencyItem = ({ currency }: { currency: (typeof availableCurrencies)[0] }) => {
    const isSelected = selectedCurrencies.includes(currency.code)

    return (
      <button
        onClick={() => toggleCurrency(currency.code)}
        style={{
          width: "100%",
          padding: "14px",
          background: isSelected ? "#F0FDFB" : "#FFFFFF",
          borderRadius: "12px",
          border: isSelected ? "2px solid #00C6AE" : "1px solid #E5E7EB",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "#F5F7FA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
          }}
        >
          {currency.flag}
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{currency.code}</p>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{currency.name}</p>
        </div>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: isSelected ? "#00C6AE" : "#F5F7FA",
            border: isSelected ? "none" : "2px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected && <Check size={14} color="#FFFFFF" />}
        </div>
      </button>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Currency</h1>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
        >
          <Search size={18} color="rgba(255,255,255,0.7)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search currencies..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: "14px",
              color: "#FFFFFF",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <Info size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Multi-currency wallet:</strong> Add currencies to hold, convert, and send money in different
            currencies. Perfect for supporting family across Africa.
          </p>
        </div>

        {/* Popular Currencies */}
        {popularCurrencies.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <Globe size={14} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>POPULAR CURRENCIES</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {popularCurrencies.map((currency) => (
                <CurrencyItem key={currency.code} currency={currency} />
              ))}
            </div>
          </div>
        )}

        {/* Other Currencies */}
        {otherCurrencies.length > 0 && (
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
              }}
            >
              MORE CURRENCIES
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {otherCurrencies.map((currency) => (
                <CurrencyItem key={currency.code} currency={currency} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {filteredCurrencies.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <Search size={40} color="#9CA3AF" style={{ marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No currencies found</p>
          </div>
        )}
      </div>

      {/* Add Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={() => console.log("Add currencies:", selectedCurrencies)}
          disabled={selectedCurrencies.length === 0}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selectedCurrencies.length > 0 ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: selectedCurrencies.length > 0 ? "#FFFFFF" : "#9CA3AF",
            cursor: selectedCurrencies.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          {selectedCurrencies.length === 0
            ? "Select Currencies"
            : `Add ${selectedCurrencies.length} Currenc${selectedCurrencies.length > 1 ? "ies" : "y"}`}
        </button>
      </div>
    </div>
  )
}
