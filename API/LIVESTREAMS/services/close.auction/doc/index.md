# Close Auction — Service Documentation

## Overview

Closes an open livestream auction and creates a pending winner order for the highest bidder, so the winner can pay after the live bidding ends.

## Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/livestreams/vendor/auctions/:auctionId/close` |
| Auth Required | ✅ |
| Required Role | `vendor` |
| Tags | Livestreams — Vendor |
