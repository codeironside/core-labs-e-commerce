# Place Bid — Service Documentation

## Overview

Places a bid on an open livestream auction. The bidder is automatically registered as a livestream participant if they have not already joined.

## Endpoint

| Property | Value |
|---|---|
| Method | `POST` |
| Path | `/api/v1/livestreams/auctions/:auctionId/bids` |
| Content-Type | `application/json` |
| Auth Required | ✅ |
| Tags | Livestreams |
