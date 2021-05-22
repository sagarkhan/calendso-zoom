import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import { createEvent, CalendarEvent } from "../../../lib/calendarClient";
import { LocationType } from "../../../lib/location";
import moment from "moment";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { user } = req.query;

  const currentUser = await prisma.user.findFirst({
    where: {
      username: user,
    },
    select: {
      credentials: true,
      timeZone: true,
    },
  });

  const evt: CalendarEvent = {
    title: "Meeting with " + req.body.name,
    description: req.body.notes,
    startTime: req.body.start,
    endTime: req.body.end,
    timeZone: currentUser.timeZone,
    location: req.body.location,
    attendees: [{ email: req.body.email, name: req.body.name }],
  };

  // TODO: for now, first integration created; primary = obvious todo; ability to change primary.
  const result = await createEvent(currentUser.credentials[0], evt);

  /* Create Zoom Meeting */
  if (req.body.location === LocationType.Zoom) {
    const payload: any = {
      topic: "Meeting with " + req.body.name,
      type: "2",
      start_time: req.body.start,
      duration: moment(req.body.end).diff(req.body.start, "minutes"),
      timezone: currentUser.timeZone,
      agenda: req.body.notes,
    };
    console.log(payload);

    const meeting: any = await axios
      .post(
        `https://api.zoom.us/v2/users/${process.env.ZOOM_USER_ID}/meetings`,
        payload,
        {
          headers: { Authorization: `Bearer ${process.env.ZOOM_JWT}` },
        }
      )
      .catch((err) => console.error("Zoom meeting schedule failed ", err));
    result.meeting = meeting.data;
    console.log(result);
  }
  res.status(200).json(result);
}
