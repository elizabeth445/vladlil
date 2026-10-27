# Локальные фрагменты восстановления

Эти прозрачные PNG — исходные материалы для `scripts/refine-story-frames.py`, не самостоятельные иллюстрации и не новые сцены. Они созданы встроенным инструментом `imagegen`, совмещены с исходными кадрами по SIFT/RANSAC и обрезаны до нужных областей. Остальная перерисованная часть результатов генерации не используется.

`patches.json` содержит прямоугольники фрагментов в координатах опорных кадров. Для львёнка они относятся к холсту с 64 px сверху; для котёнка — к исходному холсту. Исходные MP4 и базовые `rgba/` кадры не изменяются.

Применённые запросы:

- Финальная поза львёнка: “Restore ONLY the cut-off small gold crown tips above y=64 around x=410..535, and the cut-off bottom of the small blue car near x=172..355 below y=567. Complete the clipped top of the small gold decorative star. Preserve the exact composition, character and all other objects; transparent background.”
- Начальная поза львёнка: “Restore ONLY the missing clipped top tips of the golden crown, the missing top of the small gold star, and the missing bottom of the closed white-and-blue gift box. Complete the lower edges and blue vertical ribbons in the existing perspective. Keep original positions, appearance and everything else unchanged; transparent background.”
- Коробка куклы: “Remove the protruding legs, feet, shoes and skirt fragments below the front rim, and restore the continuous solid pink front face and vertical ribbon of the gift box in the existing perspective. Only the doll's head, upper torso and arms emerge above the rim. Preserve the kitten, doll's right arm, lid, flowers, butterflies and ribbons outside the box; transparent background.”

Коррекция коробки начинает плавно применяться на кадрах 128–144, до появления ошибочных ног. Движение самой куклы, мордочки и лап котёнка сохранено. Фрагменты короны и машинки находятся только за исходными верхней и нижней границами камеры; внутри исходного кадра львёнка пиксели сохранены.
