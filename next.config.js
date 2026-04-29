/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expose Razorpay key ID to the browser bundle at build time.
  // Railway (and any host) only needs RAZORPAY_KEY_ID set — no separate
  // NEXT_PUBLIC_ variable required.
  env: {
    NEXT_PUBLIC_RAZORPAY_KEY_ID:
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    minimumCacheTTL: 60,
  }
};

module.exports = nextConfig;
