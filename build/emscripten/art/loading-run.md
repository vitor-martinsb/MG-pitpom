# Loading mascots

`loading-run.png` was generated with the built-in imagegen tool using the user's
cartoon reference. Pituca is the black-and-white spotted dog without a visible
tail; Pompom is the orange-and-white tabby cat. The transparent original is kept
intact. `adventure.js` clips and centers eight poses per character, and CSS plays
the gallop frames while the characters chase each other in a circle. Reduced
motion shows the first pose of each mascot.

Generation prompt:

> Create a transparent running-animation sprite atlas matching the supplied
> character reference faithfully: bold rounded charcoal outlines, large glossy
> friendly eyes, cream-white fur, warm orange tabby stripes, tiny pink cat nose,
> a white forehead blaze and floppy black ears on the spotted dog, happy pink
> tongue, no visible dog tail. Exactly four columns and four rows, sixteen equal
> cells. First two rows: eight consecutive distinct poses of Pompom running
> right, curved striped tail and cycling paws. Last two rows: eight consecutive
> distinct poses of Pituca running left, bouncing ears and cycling paws, black
> saddle patch and small gray spots. Stable proportions, identity, scale and
> centers, completely contained sprites, no scene, text, grid lines or motion
> marks.

Layout refinement prompt:

> Change only layout and scale to an exact regular four-column four-row grid.
> Preserve all sixteen poses and character identities, colors and outlines.
> Center each sprite within its equal cell with transparent margins on all
> sides, maintaining common scale and anchors. Eight cats running right in the
> first two rows, eight tailless dogs running left in the last two. Transparent
> background, no lines, text, labels or props.
